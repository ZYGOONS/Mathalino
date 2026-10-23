import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

const MAX_ATTEMPTS =
  3;

export class InvalidAnswerSubmissionError
  extends Error {
  constructor(
    message: string
  ) {
    super(message);

    this.name =
      "InvalidAnswerSubmissionError";
  }
}

export interface AnswerProcessingResult {
  correct: boolean;
  attemptCount: number;
  questionResolved: boolean;
  sessionCompleted: boolean;

  assignmentId:
    | string
    | null;

  score:
    | number
    | null;

  totalQuestions:
    | number
    | null;
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

function numberArray(
  value: unknown
): number[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item
      ) =>
        Number(
          item
        )
    )
    .filter(
      (
        item
      ) =>
        Number.isFinite(
          item
        )
    );
}

function requireInteger(
  value: unknown,
  message: string
): number {
  const result =
    Number(
      value
    );

  if (
    !Number.isInteger(
      result
    )
  ) {
    throw new InvalidAnswerSubmissionError(
      message
    );
  }

  return result;
}

function evaluateAnswer(
  previousAttempts:
    number,
  answer:
    number,
  correctAnswer:
    number
) {
  if (
    previousAttempts <
      0 ||
    previousAttempts >=
      MAX_ATTEMPTS
  ) {
    throw new InvalidAnswerSubmissionError(
      "Maximum attempts reached."
    );
  }

  if (
    answer < 0 ||
    answer > 50 ||
    correctAnswer < 0 ||
    correctAnswer > 50
  ) {
    throw new InvalidAnswerSubmissionError(
      "Answer is outside the supported range."
    );
  }

  const attempt =
    previousAttempts +
    1;

  const correct =
    answer ===
    correctAnswer;

  const resolved =
    correct ||
    attempt ===
      MAX_ATTEMPTS;

  return {
    attempt,
    correct,
    resolved,
  };
}

export async function processAnswerSubmission(
  submissionId: string,
  teacherId: string
): Promise<AnswerProcessingResult> {
  if (
    !submissionId.trim()
  ) {
    throw new InvalidAnswerSubmissionError(
      "Submission ID is required."
    );
  }

  if (
    !teacherId.trim()
  ) {
    throw new InvalidAnswerSubmissionError(
      "Teacher ID is required."
    );
  }

  const submissionReference =
    doc(
      db,
      "answerSubmissions",
      submissionId
    );

  return runTransaction(
    db,
    async (
      transaction
    ) => {
      /*
       * =========================
       * AUTHENTICATION
       * =========================
       */

      if (
        auth.currentUser?.uid !==
        teacherId
      ) {
        throw new Error(
          "Account changed during processing."
        );
      }

      /*
       * =========================
       * READ SUBMISSION
       * =========================
       */

      const submissionSnapshot =
        await transaction.get(
          submissionReference
        );

      if (
        !submissionSnapshot.exists()
      ) {
        throw new InvalidAnswerSubmissionError(
          "Answer submission no longer exists."
        );
      }

      const submission =
        submissionSnapshot.data();

      /*
       * Already processed by another
       * client such as Android.
       *
       * Return the stored result instead
       * of grading twice.
       */

      if (
        submission.status ===
        "processed"
      ) {
        return {
          correct:
            submission.correct ===
            true,

          attemptCount:
            Number(
              submission.attemptCount ??
                0
            ),

          questionResolved:
            submission.resolved ===
            true,

          sessionCompleted:
            submission.completed ===
            true,

          assignmentId:
            null,

          score:
            null,

          totalQuestions:
            null,
        };
      }

      if (
        submission.status !==
        "pending"
      ) {
        throw new InvalidAnswerSubmissionError(
          "Answer submission is no longer pending."
        );
      }

      if (
        submission.teacherId !==
        teacherId
      ) {
        throw new InvalidAnswerSubmissionError(
          "Teacher does not own this answer submission."
        );
      }

      const sessionId =
        String(
          submission.sessionId ??
            ""
        );

      const boardId =
        String(
          submission.boardId ??
            ""
        );

      if (
        !sessionId ||
        !boardId
      ) {
        throw new InvalidAnswerSubmissionError(
          "Submission session or board is missing."
        );
      }

      const questionNumber =
        requireInteger(
          submission.questionNumber,
          "Question number is invalid."
        );

      const submittedAnswer =
        requireInteger(
          submission.answer,
          "Submitted answer is invalid."
        );

      const responseTimeMillis =
        requireInteger(
          submission.responseTimeMillis,
          "Response time is invalid."
        );

      const expectedAttempt =
        requireInteger(
          submission.expectedAttempt,
          "Expected attempt is invalid."
        );

      const submissionSetupMistakes =
        submission.setupMistakes ===
          undefined
          ? 0
          : requireInteger(
              submission.setupMistakes,
              "Setup mistake count is invalid."
            );

      if (
        questionNumber <= 0 ||
        questionNumber > 100
      ) {
        throw new InvalidAnswerSubmissionError(
          "Question number is invalid."
        );
      }

      if (
        submittedAnswer < 0 ||
        submittedAnswer > 50
      ) {
        throw new InvalidAnswerSubmissionError(
          "Submitted answer must be between 0 and 50."
        );
      }

      if (
        responseTimeMillis <
        0
      ) {
        throw new InvalidAnswerSubmissionError(
          "Response time cannot be negative."
        );
      }

      if (
        expectedAttempt <
          1 ||
        expectedAttempt >
          3
      ) {
        throw new InvalidAnswerSubmissionError(
          "Expected attempt is invalid."
        );
      }

      if (
        submissionSetupMistakes <
        0
      ) {
        throw new InvalidAnswerSubmissionError(
          "Setup mistake count cannot be negative."
        );
      }

      /*
       * =========================
       * READ SESSION
       * =========================
       */

      const sessionReference =
        doc(
          db,
          "liveSessions",
          sessionId
        );

      const sessionSnapshot =
        await transaction.get(
          sessionReference
        );

      if (
        !sessionSnapshot.exists()
      ) {
        throw new InvalidAnswerSubmissionError(
          "Session was not found."
        );
      }

      const session =
        sessionSnapshot.data();

      if (
        session.teacherId !==
        teacherId
      ) {
        throw new InvalidAnswerSubmissionError(
          "Teacher does not own session."
        );
      }

      if (
        session.status !==
        "active"
      ) {
        throw new InvalidAnswerSubmissionError(
          "Session is not active."
        );
      }

      if (
        Number(
          session.currentQuestion
        ) !==
        questionNumber
      ) {
        throw new InvalidAnswerSubmissionError(
          "This is not the current question."
        );
      }

      if (
        session.boardId !==
        boardId
      ) {
        throw new InvalidAnswerSubmissionError(
          "Submission board does not match the session."
        );
      }

      /*
       * =========================
       * READ RESPONSE
       * =========================
       */

      const responseReference =
        doc(
          db,
          "liveSessions",
          sessionId,
          "responses",
          responseId(
            questionNumber
          )
        );

      const responseSnapshot =
        await transaction.get(
          responseReference
        );

      if (
        !responseSnapshot.exists()
      ) {
        throw new InvalidAnswerSubmissionError(
          "Question was not found."
        );
      }

      const response =
        responseSnapshot.data();

      if (
        response.status !==
        "pending"
      ) {
        throw new InvalidAnswerSubmissionError(
          "Question is already resolved."
        );
      }

      const previousAttempts =
        Number(
          response.attemptCount ??
            0
        );

      const correctAnswer =
        Number(
          response.correctAnswer
        );

      if (
        !Number.isInteger(
          previousAttempts
        )
      ) {
        throw new InvalidAnswerSubmissionError(
          "Previous attempt count is invalid."
        );
      }

      if (
        !Number.isInteger(
          correctAnswer
        )
      ) {
        throw new InvalidAnswerSubmissionError(
          "Correct answer is invalid."
        );
      }

      /*
       * =========================
       * READ BOARD
       * =========================
       */

      const boardReference =
        doc(
          db,
          "boards",
          boardId
        );

      const boardSnapshot =
        await transaction.get(
          boardReference
        );

      if (
        !boardSnapshot.exists()
      ) {
        throw new InvalidAnswerSubmissionError(
          "Board no longer exists."
        );
      }

      const board =
        boardSnapshot.data();

      if (
        board.currentSessionId !==
          sessionId ||
        board.teacherId !==
          teacherId
      ) {
        throw new InvalidAnswerSubmissionError(
          "Board session has changed."
        );
      }

      /*
       * =========================
       * VALIDATE EXPECTED ATTEMPT
       * =========================
       *
       * This protects against delayed
       * or duplicate ESP32 uploads.
       */

      if (
        expectedAttempt !==
        previousAttempts + 1
      ) {
        throw new InvalidAnswerSubmissionError(
          "Stale or invalid answer submission."
        );
      }

      /*
       * =========================
       * APPLY 3-ATTEMPT POLICY
       * =========================
       */

      const decision =
        evaluateAnswer(
          previousAttempts,
          submittedAnswer,
          correctAnswer
        );

      const {
        attempt,
        correct,
        resolved,
      } =
        decision;

      const totalQuestions =
        Number(
          session.totalQuestions ??
            0
        );

      if (
        !Number.isInteger(
          totalQuestions
        ) ||
        totalQuestions <
          1
      ) {
        throw new InvalidAnswerSubmissionError(
          "Session question count is invalid."
        );
      }

      const sessionCompleted =
        resolved &&
        questionNumber >=
          totalQuestions;

      /*
       * =========================
       * MARK SUBMISSION PROCESSED
       * =========================
       */

      transaction.update(
        submissionReference,
        {
          status:
            "processed",

          correct,

          attemptCount:
            attempt,

          resolved,

          completed:
            sessionCompleted,

          processedAt:
            serverTimestamp(),
        }
      );

      /*
       * =========================
       * UPDATE RESPONSE HISTORY
       * =========================
       */

      const submittedAnswers =
        [
          ...numberArray(
            response.submittedAnswers
          ),

          submittedAnswer,
        ];

      const responseTimesMillis =
        [
          ...numberArray(
            response.responseTimesMillis
          ),

          responseTimeMillis,
        ];

      const currentSetupMistakes =
        Number(
          response.setupMistakes ??
            0
        );

      const setupMistakes =
        Math.max(
          Number.isFinite(
            currentSetupMistakes
          )
            ? currentSetupMistakes
            : 0,

          submissionSetupMistakes
        );

      const responseUpdates:
        Record<
          string,
          unknown
        > = {
          setupMistakes,

          submittedAnswer,

          submittedAnswers,

          attemptCount:
            attempt,

          responseTimeMillis,

          responseTimesMillis,

          updatedAt:
            serverTimestamp(),
        };

      /*
       * Wrong attempts 1 and 2 remain
       * pending so the same question
       * can be answered again.
       */

      if (resolved) {
        responseUpdates.isCorrect =
          correct;

        responseUpdates.status =
          correct
            ? "correct"
            : "unsuccessful";

        responseUpdates.answeredAt =
          serverTimestamp();
      }

      transaction.update(
        responseReference,
        responseUpdates
      );

      /*
       * =========================
       * SAME QUESTION CONTINUES
       * =========================
       */

      if (!resolved) {
        return {
          correct:
            false,

          attemptCount:
            attempt,

          questionResolved:
            false,

          sessionCompleted:
            false,

          assignmentId:
            null,

          score:
            null,

          totalQuestions:
            null,
        };
      }

      /*
       * =========================
       * ADVANCE SESSION
       * =========================
       */

      const previousCorrect =
        Number(
          session.correctAnswers ??
            0
        );

      const previousUnsuccessful =
        Number(
          session.unsuccessfulAnswers ??
            0
        );

      const nextCorrect =
        previousCorrect +
        (
          correct
            ? 1
            : 0
        );

      const nextUnsuccessful =
        previousUnsuccessful +
        (
          correct
            ? 0
            : 1
        );

      const completed =
        questionNumber >=
        totalQuestions;

      const sessionUpdates:
        Record<
          string,
          unknown
        > = {
          correctAnswers:
            nextCorrect,

          unsuccessfulAnswers:
            nextUnsuccessful,

          currentQuestion:
            completed
              ? totalQuestions
              : questionNumber +
                1,

          updatedAt:
            serverTimestamp(),
        };

      /*
       * =========================
       * SESSION COMPLETED
       * =========================
       */

      if (completed) {
        const accuracy =
          totalQuestions ===
            0
            ? 0
            : Math.round(
                (
                  nextCorrect /
                  totalQuestions
                ) *
                  100
              );

        sessionUpdates.status =
          "completed";

        sessionUpdates.score =
          nextCorrect;

        sessionUpdates.accuracyPercent =
          accuracy;

        sessionUpdates.resultSynced =
          false;

        sessionUpdates.endedAt =
          serverTimestamp();

        /*
         * Release the physical board.
         */

        transaction.update(
          boardReference,
          {
            status:
              "available",

            currentSessionId:
              null,

            lastSeenAt:
              serverTimestamp(),
          }
        );
      }

      transaction.update(
        sessionReference,
        sessionUpdates
      );

      return {
        correct,

        attemptCount:
          attempt,

        questionResolved:
          true,

        sessionCompleted:
          completed,

        assignmentId:
          completed
            ? String(
                session.assignmentId ??
                  ""
              ) ||
              null
            : null,

        score:
          completed
            ? nextCorrect
            : null,

        totalQuestions:
          completed
            ? totalQuestions
            : null,
      };
    }
  );
}

export async function rejectAnswerSubmission(
  submissionId: string,
  teacherId: string
): Promise<void> {
  const submissionReference =
    doc(
      db,
      "answerSubmissions",
      submissionId
    );

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
          "Teacher account changed."
        );
      }

      const submission =
        await transaction.get(
          submissionReference
        );

      if (
        !submission.exists()
      ) {
        return;
      }

      const data =
        submission.data();

      /*
       * Never overwrite an answer
       * already processed by Android
       * or another browser.
       */

      if (
        data.teacherId ===
          teacherId &&
        data.status ===
          "pending"
      ) {
        transaction.update(
          submissionReference,
          {
            status:
              "rejected",
          }
        );
      }
    }
  );
}