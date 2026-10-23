import {
  useEffect,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  synchronizeCompletedSession,
} from "../services/resultSynchronization";

const RETRY_DELAY_MS =
  15_000;

function validResult(
  assignmentId:
    unknown,
  score:
    unknown,
  total:
    unknown
): assignmentId is string {
  if (
    typeof assignmentId !==
      "string" ||
    !assignmentId.trim()
  ) {
    return false;
  }

  const scoreNumber =
    Number(
      score
    );

  const totalNumber =
    Number(
      total
    );

  return (
    Number.isInteger(
      scoreNumber
    ) &&
    Number.isInteger(
      totalNumber
    ) &&
    totalNumber >
      0 &&
    scoreNumber >=
      0 &&
    scoreNumber <=
      totalNumber
  );
}

export function useResultSynchronization() {
  useEffect(
    () => {
      let unsubscribeSessions:
        | (() => void)
        | undefined;

      let retryTimer:
        | number
        | undefined;

      let generation =
        0;

      let currentTeacherId:
        | string
        | null =
        null;

      const syncing =
        new Set<string>();

      const clearRetry =
        () => {
          if (
            retryTimer !==
            undefined
          ) {
            window.clearTimeout(
              retryTimer
            );

            retryTimer =
              undefined;
          }
        };

      const stopListener =
        () => {
          if (
            unsubscribeSessions
          ) {
            unsubscribeSessions();

            unsubscribeSessions =
              undefined;
          }
        };

      const startListener = (
        teacherId: string,
        token: number
      ) => {
        stopListener();

        const sessionsQuery =
          query(
            collection(
              db,
              "liveSessions"
            ),
            where(
              "teacherId",
              "==",
              teacherId
            )
          );

        unsubscribeSessions =
          onSnapshot(
            sessionsQuery,
            (
              snapshot
            ) => {
              if (
                token !==
                  generation ||
                currentTeacherId !==
                  teacherId
              ) {
                return;
              }

              snapshot.docs
                .filter(
                  (
                    sessionDocument
                  ) => {
                    const data =
                      sessionDocument.data();

                    return (
                      data.status ===
                        "completed" &&
                      data.resultSynced !==
                        true
                    );
                  }
                )
                .forEach(
                  (
                    sessionDocument
                  ) => {
                    if (
                      syncing.has(
                        sessionDocument.id
                      )
                    ) {
                      return;
                    }

                    const data =
                      sessionDocument.data();

                    const assignmentId =
                      data.assignmentId;

                    const score =
                      data.score;

                    const total =
                      data.totalQuestions;

                    /*
                     * Same recovery gate
                     * as Android.
                     */

                    if (
                      !validResult(
                        assignmentId,
                        score,
                        total
                      )
                    ) {
                      console.error(
                        `Mathalino result sync: completed session ${sessionDocument.id} has incomplete result data. Results were not saved.`
                      );

                      return;
                    }

                    syncing.add(
                      sessionDocument.id
                    );

                    console.info(
                      "Mathalino: Saving learner results..."
                    );

                    void synchronizeCompletedSession(
                      sessionDocument.id,
                      assignmentId,
                      Number(
                        score
                      ),
                      Number(
                        total
                      ),
                      teacherId
                    )
                      .then(
                        () => {
                          if (
                            token !==
                              generation ||
                            currentTeacherId !==
                              teacherId
                          ) {
                            return;
                          }

                          syncing.delete(
                            sessionDocument.id
                          );

                          console.info(
                            "Mathalino: Learner results saved. Board released."
                          );
                        }
                      )
                      .catch(
                        (
                          error
                        ) => {
                          if (
                            token !==
                              generation
                          ) {
                            return;
                          }

                          console.error(
                            `Mathalino result sync failed for session ${sessionDocument.id}:`,
                            error
                          );

                          syncing.delete(
                            sessionDocument.id
                          );

                          clearRetry();

                          console.warn(
                            "Mathalino: Results pending. Retrying in 15 seconds."
                          );

                          retryTimer =
                            window.setTimeout(
                              () => {
                                if (
                                  token !==
                                    generation ||
                                  !currentTeacherId
                                ) {
                                  return;
                                }

                                startListener(
                                  currentTeacherId,
                                  token
                                );
                              },
                              RETRY_DELAY_MS
                            );
                        }
                      );
                  }
                );
            },
            (
              error
            ) => {
              if (
                token !==
                generation
              ) {
                return;
              }

              console.error(
                "Mathalino: Could not read completed sessions:",
                error
              );

              clearRetry();

              retryTimer =
                window.setTimeout(
                  () => {
                    if (
                      token !==
                        generation ||
                      !currentTeacherId
                    ) {
                      return;
                    }

                    startListener(
                      currentTeacherId,
                      token
                    );
                  },
                  RETRY_DELAY_MS
                );
            }
          );
      };

      const unsubscribeAuth =
        onAuthStateChanged(
          auth,
          (
            user
          ) => {
            generation +=
              1;

            const token =
              generation;

            clearRetry();

            stopListener();

            syncing.clear();

            currentTeacherId =
              user?.uid ??
              null;

            if (!user) {
              return;
            }

            startListener(
              user.uid,
              token
            );
          }
        );

      return () => {
        generation +=
          1;

        currentTeacherId =
          null;

        clearRetry();

        stopListener();

        syncing.clear();

        unsubscribeAuth();
      };
    },
    []
  );
}