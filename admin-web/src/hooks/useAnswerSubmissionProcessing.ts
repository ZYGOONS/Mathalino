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
  InvalidAnswerSubmissionError,
  processAnswerSubmission,
  rejectAnswerSubmission,
} from "../services/answerSubmissionProcessor";

const RETRY_DELAY_MS =
  15_000;

export function useAnswerSubmissionProcessing() {
  useEffect(
    () => {
      let unsubscribeAnswers:
        | (() => void)
        | undefined;

      let retryTimer:
        | number
        | undefined;

      let currentTeacherId:
        | string
        | null =
        null;

      let generation =
        0;

      const inFlight =
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

      const stopAnswerListener =
        () => {
          if (
            unsubscribeAnswers
          ) {
            unsubscribeAnswers();

            unsubscribeAnswers =
              undefined;
          }
        };

      const startListener = (
        teacherId:
          string,
        token:
          number
      ) => {
        stopAnswerListener();

        const answersQuery =
          query(
            collection(
              db,
              "answerSubmissions"
            ),
            where(
              "teacherId",
              "==",
              teacherId
            )
          );

        unsubscribeAnswers =
          onSnapshot(
            answersQuery,
            {
              includeMetadataChanges:
                true,
            },
            (
              snapshot
            ) => {
              if (
                token !==
                generation
              ) {
                return;
              }

              /*
               * Android warns when the
               * listener is temporarily
               * serving cached data.
               *
               * We still allow the
               * transaction to try.
               */

              if (
                snapshot.metadata
                  .fromCache
              ) {
                console.warn(
                  "Mathalino: Waiting for server connection. Pending answers will retry automatically."
                );
              }

              snapshot.docs
                .filter(
                  (
                    submission
                  ) =>
                    submission.data()
                      .status ===
                    "pending"
                )
                .forEach(
                  (
                    submission
                  ) => {
                    if (
                      inFlight.has(
                        submission.id
                      )
                    ) {
                      return;
                    }

                    inFlight.add(
                      submission.id
                    );

                    console.info(
                      "Mathalino: Processing answer..."
                    );

                    void processAnswerSubmission(
                      submission.id,
                      teacherId
                    )
                      .then(
                        (
                          result
                        ) => {
                          if (
                            token !==
                            generation
                          ) {
                            return;
                          }

                          console.info(
                            "Mathalino: Answer saved.",
                            result
                          );

                          inFlight.delete(
                            submission.id
                          );
                        }
                      )
                      .catch(
                        (
                          error:
                            unknown
                        ) => {
                          if (
                            token !==
                            generation
                          ) {
                            return;
                          }

                          /*
                           * Invalid/stale answer:
                           * reject it WITHOUT
                           * consuming an attempt.
                           */

                          if (
                            error instanceof
                            InvalidAnswerSubmissionError
                          ) {
                            void rejectAnswerSubmission(
                              submission.id,
                              teacherId
                            )
                              .then(
                                () => {
                                  console.warn(
                                    "Mathalino: Stale or invalid submission rejected without consuming an attempt."
                                  );
                                }
                              )
                              .catch(
                                (
                                  rejectError
                                ) => {
                                  console.error(
                                    "Could not reject invalid answer:",
                                    rejectError
                                  );
                                }
                              )
                              .finally(
                                () => {
                                  inFlight.delete(
                                    submission.id
                                  );
                                }
                              );

                            return;
                          }

                          /*
                           * Network / transaction
                           * interruption.
                           *
                           * Do not reject because
                           * the submission may
                           * still be valid.
                           */

                          console.error(
                            "Mathalino: Answer processing interrupted.",
                            error
                          );

                          inFlight.delete(
                            submission.id
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

                                console.info(
                                  "Mathalino: Retrying answer listener..."
                                );

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
                "Mathalino: Could not receive answers.",
                error
              );

              stopAnswerListener();

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

            stopAnswerListener();

            inFlight.clear();

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

        stopAnswerListener();

        inFlight.clear();

        unsubscribeAuth();
      };
    },
    []
  );
}