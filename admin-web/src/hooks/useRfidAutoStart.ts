import {
  useEffect,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  generateActivityQuestions,
  type GeneratedQuestion,
  type QuestionActivity,
} from "../services/activityQuestionGenerator";

interface RfidScan {
  id: string;

  teacherId: string;
  boardId: string;
  uid: string;

  readerId: number;

  consumed: boolean;

  scannedAt:
    | Timestamp
    | null;
}

interface RfidCard {
  teacherId: string;
  learnerId: string;
}

interface LearnerData {
  id: string;

  teacherId: string;

  firstName: string;
  lastName: string;

  status: string;

  rfidUid:
    | string
    | null;

  activeSessionId:
    | string
    | null;

  activeAssignmentId:
    | string
    | null;
}

interface AssignmentData {
  id: string;

  teacherId: string;
  learnerId: string;

  activityId: string;
  activityTitle: string;

  status: string;

  currentSessionId:
    | string
    | null;
}

interface BoardData {
  id: string;

  teacherId: string;

  name: string;

  status: string;

  currentSessionId:
    | string
    | null;

  enabled: boolean;
  linked: boolean;
}

interface ActivityData
  extends QuestionActivity {
  id: string;

  teacherId: string;

  title: string;
  topic: string;
  difficulty: string;

  minNumber: number;
  maxNumber: number;

  questionCount: number;
}

function getFullName(
  learner:
    LearnerData
): string {
  return [
    learner.firstName,
    learner.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function unfinished(
  status: string
): boolean {
  return (
    status ===
      "assigned" ||
    status ===
      "in_progress"
  );
}

function boardSelectable(
  board:
    BoardData
): boolean {
  const busy =
    board.status ===
      "in_session" ||
    Boolean(
      board.currentSessionId
    );

  return (
    board.linked &&
    board.enabled &&
    board.status ===
      "available" &&
    !busy
  );
}

function responseId(
  questionNumber:
    number
): string {
  return questionNumber
    .toString()
    .padStart(
      3,
      "0"
    );
}

function scanAge(
  scannedAt:
    Timestamp | null
): number {
  if (!scannedAt) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    Date.now() -
    scannedAt.toMillis()
  );
}

function freshScan(
  scan:
    RfidScan
): boolean {
  const age =
    scanAge(
      scan.scannedAt
    );

  return (
    !scan.consumed &&
    scan.readerId ===
      5 &&
    age >= 0 &&
    age <=
      30_000
  );
}

function normalizeSavedQuestions(
  value: unknown
): GeneratedQuestion[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value.map(
    (
      item,
      index
    ) => {
      const question =
        item as
          Record<
            string,
            unknown
          >;

      return {
        number:
          Number(
            question.number ??
              index + 1
          ),

        prompt:
          String(
            question.prompt ??
              ""
          ),

        correctAnswer:
          Number(
            question.correctAnswer ??
              0
          ),

        firstOperand:
          question.firstOperand ===
            null ||
          question.firstOperand ===
            undefined
            ? null
            : Number(
                question.firstOperand
              ),

        operator:
          String(
            question.operator ??
              ""
          ),

        secondOperand:
          question.secondOperand ===
            null ||
          question.secondOperand ===
            undefined
            ? null
            : Number(
                question.secondOperand
              ),

        questionType:
          String(
            question.questionType ??
              ""
          ),
      };
    }
  );
}

function scanFromDocument(
  document:
    QueryDocumentSnapshot<DocumentData>
): RfidScan {
  const data =
    document.data();

  return {
    id:
      document.id,

    teacherId:
      data.teacherId ??
      "",

    boardId:
      data.boardId ??
      "",

    uid:
      data.uid ??
      "",

    readerId:
      Number(
        data.readerId ??
          0
      ),

    consumed:
      data.consumed ===
      true,

    scannedAt:
      data.scannedAt ??
      null,
  };
}

async function processScan(
  scan:
    RfidScan,
  teacherId:
    string
): Promise<void> {
  /*
   * =========================
   * CARD
   * =========================
   */

  if (
    !scan.uid
  ) {
    throw new Error(
      "RFID scan has no card UID."
    );
  }

  const cardSnapshot =
    await getDocFromServer(
      doc(
        db,
        "rfidCards",
        scan.uid
      )
    );

  if (
    !cardSnapshot.exists()
  ) {
    throw new Error(
      "Card is not linked to this teacher."
    );
  }

  const cardData =
    cardSnapshot.data();

  const card:
    RfidCard = {
      teacherId:
        cardData.teacherId ??
        "",

      learnerId:
        cardData.learnerId ??
        "",
    };

  if (
    card.teacherId !==
    teacherId
  ) {
    throw new Error(
      "Card is not linked to this teacher."
    );
  }

  if (
    !card.learnerId
  ) {
    throw new Error(
      "Card is unlinked."
    );
  }

  /*
   * =========================
   * LEARNER
   * =========================
   */

  const learnerSnapshot =
    await getDocFromServer(
      doc(
        db,
        "learners",
        card.learnerId
      )
    );

  if (
    !learnerSnapshot.exists()
  ) {
    throw new Error(
      "Learner unavailable."
    );
  }

  const learnerSource =
    learnerSnapshot.data();

  const learner:
    LearnerData = {
      id:
        learnerSnapshot.id,

      teacherId:
        learnerSource.teacherId ??
        "",

      firstName:
        learnerSource.firstName ??
        "",

      lastName:
        learnerSource.lastName ??
        "",

      status:
        learnerSource.status ??
        "active",

      rfidUid:
        learnerSource.rfidUid ??
        null,

      activeSessionId:
        learnerSource.activeSessionId ??
        null,

      activeAssignmentId:
        learnerSource.activeAssignmentId ??
        null,
    };

  /*
   * =========================
   * ASSIGNMENT
   * =========================
   */

  const assignmentsSnapshot =
    await getDocsFromServer(
      query(
        collection(
          db,
          "assignments"
        ),
        where(
          "teacherId",
          "==",
          teacherId
        ),
        where(
          "learnerId",
          "==",
          learner.id
        )
      )
    );

  const candidates:
    AssignmentData[] =
    assignmentsSnapshot.docs
      .map(
        (
          assignmentDocument
        ) => {
          const data =
            assignmentDocument.data();

          return {
            id:
              assignmentDocument.id,

            teacherId:
              data.teacherId ??
              "",

            learnerId:
              data.learnerId ??
              "",

            activityId:
              data.activityId ??
              "",

            activityTitle:
              data.activityTitle ??
              "",

            status:
              data.status ??
              "",

            currentSessionId:
              data.currentSessionId ??
              null,
          };
        }
      )
      .filter(
        (
          assignment
        ) =>
          unfinished(
            assignment.status
          )
      );

  if (
    candidates.length ===
    0
  ) {
    throw new Error(
      "No assigned activity."
    );
  }

  if (
    candidates.length >
    1
  ) {
    throw new Error(
      "Multiple unfinished activities exist. Resolve these before starting."
    );
  }

  const assignment =
    candidates[0];

  if (
    assignment.status !==
    "assigned"
  ) {
    throw new Error(
      "Learner already has a session."
    );
  }

  /*
   * =========================
   * BOARD
   * =========================
   */

  if (
    !scan.boardId
  ) {
    throw new Error(
      "Board unavailable."
    );
  }

  const boardSnapshot =
    await getDocFromServer(
      doc(
        db,
        "boards",
        scan.boardId
      )
    );

  if (
    !boardSnapshot.exists()
  ) {
    throw new Error(
      "Board unavailable."
    );
  }

  const boardSource =
    boardSnapshot.data();

  const board:
    BoardData = {
      id:
        boardSnapshot.id,

      teacherId:
        boardSource.teacherId ??
        "",

      name:
        boardSource.name ??
        "",

      status:
        boardSource.status ??
        "offline",

      currentSessionId:
        boardSource.currentSessionId ??
        null,

      enabled:
        boardSource.enabled ??
        true,

      linked:
        boardSource.linked ??
        true,
    };

  if (
    board.teacherId !==
      teacherId ||
    !boardSelectable(
      board
    )
  ) {
    throw new Error(
      "Board busy or disabled."
    );
  }

  /*
   * =========================
   * ACTIVITY
   * =========================
   */

  if (
    !assignment.activityId
  ) {
    throw new Error(
      "Activity unavailable."
    );
  }

  const activitySnapshot =
    await getDocFromServer(
      doc(
        db,
        "activities",
        assignment.activityId
      )
    );

  if (
    !activitySnapshot.exists()
  ) {
    throw new Error(
      "Activity unavailable."
    );
  }

  if (
    auth.currentUser?.uid !==
    teacherId
  ) {
    throw new Error(
      "Teacher signed out."
    );
  }

  const activitySource =
    activitySnapshot.data();

  const activity:
    ActivityData = {
      id:
        activitySnapshot.id,

      teacherId:
        activitySource.teacherId ??
        "",

      title:
        activitySource.title ??
        "",

      topic:
        activitySource.topic ??
        "",

      difficulty:
        activitySource.difficulty ??
        "easy",

      questionCount:
        Number(
          activitySource.questionCount ??
            0
        ),

      minNumber:
        Number(
          activitySource.minNumber ??
            0
        ),

      maxNumber:
        Number(
          activitySource.maxNumber ??
            10
        ),

      savedQuestions:
        normalizeSavedQuestions(
          activitySource.savedQuestions
        ),
    };

  if (
    activity.teacherId !==
    teacherId
  ) {
    throw new Error(
      "Activity ownership changed."
    );
  }

  const questions =
    generateActivityQuestions(
      activity
    );

  if (
    questions.length <
    1
  ) {
    throw new Error(
      "At least one question is required."
    );
  }

  if (
    questions.length >
    100
  ) {
    throw new Error(
      "A session supports at most 100 questions."
    );
  }

  /*
   * Create the session ID before
   * entering the transaction.
   */

  const sessionReference =
    doc(
      collection(
        db,
        "liveSessions"
      )
    );

  /*
   * =========================
   * ATOMIC SESSION START
   * =========================
   */

  await runTransaction(
    db,
    async (
      transaction
    ) => {
      if (
        auth.currentUser?.uid !==
        teacherId
      ) {
        throw new Error(
          "Teacher signed out."
        );
      }

      /*
       * ALL READS FIRST
       */

      const assignmentReference =
        doc(
          db,
          "assignments",
          assignment.id
        );

      const currentAssignment =
        await transaction.get(
          assignmentReference
        );

      const boardReference =
        doc(
          db,
          "boards",
          board.id
        );

      const currentBoard =
        await transaction.get(
          boardReference
        );

      const learnerReference =
        doc(
          db,
          "learners",
          learner.id
        );

      const currentLearner =
        await transaction.get(
          learnerReference
        );

      const activeSessionId =
        currentLearner.data()
          ?.activeSessionId;

      const priorSession =
        activeSessionId
          ? await transaction.get(
              doc(
                db,
                "liveSessions",
                activeSessionId
              )
            )
          : null;

      const scanReference =
        doc(
          db,
          "rfidScans",
          scan.id
        );

      const currentScan =
        await transaction.get(
          scanReference
        );

      const currentScanUid =
        currentScan.data()
          ?.uid;

      const cardReference =
        doc(
          db,
          "rfidCards",
          String(
            currentScanUid ??
              scan.uid
          )
        );

      const currentCard =
        await transaction.get(
          cardReference
        );

      /*
       * =========================
       * VALIDATE ASSIGNMENT
       * =========================
       */

      if (
        !currentAssignment.exists()
      ) {
        throw new Error(
          "Assignment is cancelled, completed, or already in use. Refresh your selection."
        );
      }

      const currentAssignmentData =
        currentAssignment.data();

      if (
        currentAssignmentData.teacherId !==
          teacherId ||
        currentAssignmentData.learnerId !==
          learner.id ||
        currentAssignmentData.activityId !==
          activity.id ||
        currentAssignmentData.status !==
          "assigned" ||
        Boolean(
          currentAssignmentData.currentSessionId
        )
      ) {
        throw new Error(
          "Assignment is cancelled, completed, or already in use. Refresh your selection."
        );
      }

      /*
       * =========================
       * VALIDATE LEARNER
       * =========================
       */

      if (
        !currentLearner.exists()
      ) {
        throw new Error(
          "Learner unavailable."
        );
      }

      const currentLearnerData =
        currentLearner.data();

      if (
        currentLearnerData.teacherId !==
          teacherId ||
        currentLearnerData.status !==
          "active"
      ) {
        throw new Error(
          "Learner unavailable."
        );
      }

      if (
        priorSession?.exists() &&
        priorSession.data()
          .status ===
          "active"
      ) {
        throw new Error(
          "Learner is already using another board."
        );
      }

      /*
       * =========================
       * VALIDATE RFID SCAN
       * =========================
       */

      if (
        !currentScan.exists()
      ) {
        throw new Error(
          "RFID scan expired or changed."
        );
      }

      const currentScanData =
        currentScan.data();

      const currentScannedAt =
        currentScanData.scannedAt as
          | Timestamp
          | undefined;

      const currentAge =
        currentScannedAt
          ? Date.now() -
            currentScannedAt.toMillis()
          : Number.POSITIVE_INFINITY;

      if (
        currentScanData.consumed ===
          true ||
        currentScanData.boardId !==
          board.id ||
        currentScanData.teacherId !==
          teacherId ||
        currentCard.data()
          ?.learnerId !==
          learner.id ||
        currentCard.data()
          ?.teacherId !==
          teacherId ||
        currentLearnerData.rfidUid !==
          currentScanData.uid ||
        currentAge < 0 ||
        currentAge >
          30_000
      ) {
        throw new Error(
          "RFID scan expired or changed."
        );
      }

      /*
       * =========================
       * VALIDATE BOARD
       * =========================
       */

      if (
        !currentBoard.exists()
      ) {
        throw new Error(
          "Board is no longer available. Choose another board or reactivate it."
        );
      }

      const currentBoardSource =
        currentBoard.data();

      const transactionBoard:
        BoardData = {
          id:
            currentBoard.id,

          teacherId:
            currentBoardSource.teacherId ??
            "",

          name:
            currentBoardSource.name ??
            "",

          status:
            currentBoardSource.status ??
            "offline",

          currentSessionId:
            currentBoardSource.currentSessionId ??
            null,

          enabled:
            currentBoardSource.enabled ??
            true,

          linked:
            currentBoardSource.linked ??
            true,
        };

      if (
        transactionBoard.teacherId !==
          teacherId ||
        !boardSelectable(
          transactionBoard
        )
      ) {
        throw new Error(
          "Board is no longer available. Choose another board or reactivate it."
        );
      }

      /*
       * =========================
       * ALL WRITES AFTER READS
       * =========================
       */

      transaction.update(
        scanReference,
        {
          consumed:
            true,
        }
      );

      transaction.update(
        learnerReference,
        {
          activeSessionId:
            sessionReference.id,

          activeAssignmentId:
            assignment.id,
        }
      );

      transaction.update(
        assignmentReference,
        {
          status:
            "in_progress",

          hasStarted:
            true,

          currentSessionId:
            sessionReference.id,

          updatedAt:
            serverTimestamp(),
        }
      );

      transaction.set(
        sessionReference,
        {
          teacherId,

          boardId:
            board.id,

          boardName:
            board.name,

          learnerId:
            learner.id,

          learnerName:
            getFullName(
              learner
            ),

          assignmentId:
            assignment.id,

          activityId:
            activity.id,

          activityTitle:
            activity.title,

          topic:
            activity.topic,

          difficulty:
            activity.difficulty,

          minNumber:
            activity.minNumber,

          maxNumber:
            activity.maxNumber,

          connectionMethod:
            "rfid",

          status:
            "active",

          currentQuestion:
            1,

          totalQuestions:
            questions.length,

          correctAnswers:
            0,

          unsuccessfulAnswers:
            0,

          score:
            null,

          accuracyPercent:
            null,

          resultSynced:
            false,

          startedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),

          endedAt:
            null,
        }
      );

      questions.forEach(
        (
          question
        ) => {
          const responseReference =
            doc(
              db,
              "liveSessions",
              sessionReference.id,
              "responses",
              responseId(
                question.number
              )
            );

          transaction.set(
            responseReference,
            {
              teacherId,

              sessionId:
                sessionReference.id,

              questionNumber:
                question.number,

              prompt:
                question.prompt,

              questionType:
                question.questionType,

              firstOperand:
                question.firstOperand,

              operator:
                question.operator,

              secondOperand:
                question.secondOperand,

              correctAnswer:
                question.correctAnswer,

              submittedAnswer:
                null,

              submittedAnswers:
                [],

              isCorrect:
                null,

              attemptCount:
                0,

              responseTimeMillis:
                null,

              responseTimesMillis:
                [],

              status:
                "pending",

              answeredAt:
                null,

              updatedAt:
                serverTimestamp(),
            }
          );
        }
      );

      transaction.update(
        boardReference,
        {
          status:
            "in_session",

          currentSessionId:
            sessionReference.id,
        }
      );
    }
  );
}

export function useRfidAutoStart() {
  useEffect(() => {
    let unsubscribeScans:
      | (() => void)
      | undefined;

    let generation =
      0;

    const busy =
      new Set<string>();

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

          busy.clear();

          if (
            unsubscribeScans
          ) {
            unsubscribeScans();
            unsubscribeScans =
              undefined;
          }

          if (!user) {
            return;
          }

          const teacherId =
            user.uid;

          const scansQuery =
            query(
              collection(
                db,
                "rfidScans"
              ),
              where(
                "teacherId",
                "==",
                teacherId
              )
            );

          unsubscribeScans =
            onSnapshot(
              scansQuery,
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
                 * Match Android:
                 * do not process a cache-only
                 * RFID snapshot.
                 */

                if (
                  snapshot.metadata
                    .fromCache
                ) {
                  return;
                }

                const scans =
                  snapshot.docs.map(
                    scanFromDocument
                  );

                /*
                 * Remove old scan IDs from
                 * the local busy set after
                 * their 30-second window.
                 */

                const freshIds =
                  new Set(
                    scans
                      .filter(
                        (
                          scan
                        ) =>
                          scanAge(
                            scan.scannedAt
                          ) <=
                          30_000
                      )
                      .map(
                        (
                          scan
                        ) =>
                          scan.id
                      )
                  );

                for (
                  const scanId
                  of busy
                ) {
                  if (
                    !freshIds.has(
                      scanId
                    )
                  ) {
                    busy.delete(
                      scanId
                    );
                  }
                }

                scans
                  .filter(
                    freshScan
                  )
                  .forEach(
                    (
                      scan
                    ) => {
                      if (
                        busy.has(
                          scan.id
                        )
                      ) {
                        return;
                      }

                      busy.add(
                        scan.id
                      );

                      void processScan(
                        scan,
                        teacherId
                      )
                        .then(
                          () => {
                            if (
                              token ===
                              generation
                            ) {
                              console.info(
                                "Mathalino: RFID session started."
                              );
                            }
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
                             * An unlinked card
                             * intentionally stays
                             * available for the
                             * separate RFID-linking
                             * feature.
                             */

                            console.warn(
                              "Mathalino RFID auto-start:",
                              error
                            );
                          }
                        );
                    }
                  );
              },
              (
                error
              ) => {
                console.error(
                  "RFID auto-start unavailable:",
                  error
                );
              }
            );
        }
      );

    return () => {
      generation +=
        1;

      busy.clear();

      unsubscribeAuth();

      if (
        unsubscribeScans
      ) {
        unsubscribeScans();
      }
    };
  }, []);
}