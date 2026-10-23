import {
  collection,
  doc,
  getDocsFromServer,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

export interface RecommendationQuestion {
  number: number;
  prompt: string;
  correctAnswer: number;

  firstOperand:
    | number
    | null;

  operator: string;

  secondOperand:
    | number
    | null;

  questionType: string;
}

export interface AdaptiveRecommendation {
  id: string;

  teacherId: string;
  learnerId: string;

  sourceAssignmentId: string;

  topic: string;

  masteryPercent: number;
  masteryLevel: string;

  currentDifficulty: string;
  currentMinNumber: number;
  currentMaxNumber: number;

  recommendedDifficulty: string;
  recommendedMinNumber: number;
  recommendedMaxNumber: number;

  questionCount: number;

  previewQuestions:
    RecommendationQuestion[];

  activityId: string;
  assignmentId: string;

  reason: string;
  evidence: string;

  status: string;
}

function unfinished(
  status: unknown
): boolean {
  return (
    status === "assigned" ||
    status === "in_progress"
  );
}

function topicId(
  topic: string
): string {
  switch (topic) {
    case "Addition":
      return "addition";

    case "Subtraction":
      return "subtraction";

    case "Number Sense":
      return "number_sense";

    default:
      throw new Error(
        "Unsupported recommendation topic."
      );
  }
}

function validQuestion(
  value:
    RecommendationQuestion
): boolean {
  return (
    Number.isInteger(
      value.number
    ) &&
    value.number >= 1 &&
    typeof value.prompt ===
      "string" &&
    value.prompt.trim().length >
      0 &&
    Number.isInteger(
      value.correctAnswer
    ) &&
    value.correctAnswer >= 0 &&
    value.correctAnswer <= 50
  );
}

function sameQuestions(
  first:
    RecommendationQuestion[],
  second:
    RecommendationQuestion[]
): boolean {
  if (
    first.length !==
    second.length
  ) {
    return false;
  }

  return first.every(
    (
      question,
      index
    ) => {
      const other =
        second[index];

      return (
        question.number ===
          other.number &&
        question.prompt ===
          other.prompt &&
        question.correctAnswer ===
          other.correctAnswer &&
        question.firstOperand ===
          other.firstOperand &&
        question.operator ===
          other.operator &&
        question.secondOperand ===
          other.secondOperand &&
        question.questionType ===
          other.questionType
      );
    }
  );
}

export async function reviewRecommendation(
  expected:
    AdaptiveRecommendation,
  decision:
    "approved" |
    "dismissed"
): Promise<void> {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Teacher session expired."
    );
  }

  /*
   * Android checks all older
   * assignments before approving.
   */

  if (
    decision ===
    "approved"
  ) {
    const existingAssignments =
      await getDocsFromServer(
        query(
          collection(
            db,
            "assignments"
          ),
          where(
            "teacherId",
            "==",
            user.uid
          ),
          where(
            "learnerId",
            "==",
            expected.learnerId
          )
        )
      );

    const hasUnfinished =
      existingAssignments.docs.some(
        (
          assignment
        ) =>
          unfinished(
            assignment.data()
              .status
          )
      );

    if (hasUnfinished) {
      throw new Error(
        "This learner already has an unfinished activity. Finish it before approving this recommendation."
      );
    }
  }

  const recommendationReference =
    doc(
      db,
      "recommendations",
      expected.learnerId,
      "topics",
      topicId(
        expected.topic
      )
    );

  const historyReference =
    doc(
      db,
      "recommendations",
      expected.learnerId,
      "history",
      expected.sourceAssignmentId
    );

  const learnerReference =
    doc(
      db,
      "learners",
      expected.learnerId
    );

  const activityReference =
    doc(
      collection(
        db,
        "activities"
      )
    );

  const assignmentReference =
    doc(
      collection(
        db,
        "assignments"
      )
    );

  await runTransaction(
    db,
    async (
      transaction
    ) => {
      /*
       * =====================
       * READ CURRENT RECORDS
       * =====================
       */

      const recommendationSnapshot =
        await transaction.get(
          recommendationReference
        );

      const learnerSnapshot =
        await transaction.get(
          learnerReference
        );

      if (
        !recommendationSnapshot.exists()
      ) {
        throw new Error(
          "Recommendation unavailable."
        );
      }

      if (
        !learnerSnapshot.exists()
      ) {
        throw new Error(
          "Learner unavailable."
        );
      }

      const recommendationData =
        recommendationSnapshot.data();

      const learnerData =
        learnerSnapshot.data();

      const activeAssignmentId =
        typeof learnerData
          .activeAssignmentId ===
          "string"
          ? learnerData
              .activeAssignmentId
          : "";

      let previousAssignmentStatus:
        unknown =
        null;

      if (
        decision ===
          "approved" &&
        activeAssignmentId
      ) {
        const previousAssignment =
          await transaction.get(
            doc(
              db,
              "assignments",
              activeAssignmentId
            )
          );

        if (
          previousAssignment.exists()
        ) {
          previousAssignmentStatus =
            previousAssignment.data()
              .status;
        }
      }

      /*
       * =====================
       * VALIDATE OWNERSHIP
       * =====================
       */

      if (
        recommendationData
          .teacherId !==
          user.uid ||
        recommendationData
          .learnerId !==
          expected.learnerId ||
        learnerData.teacherId !==
          user.uid
      ) {
        throw new Error(
          "Learner ownership changed."
        );
      }

      /*
       * =====================
       * STALE PREVIEW CHECK
       * =====================
       */

      const currentQuestions =
        Array.isArray(
          recommendationData
            .previewQuestions
        )
          ? recommendationData
              .previewQuestions as
              RecommendationQuestion[]
          : [];

      const recommendationChanged =
        recommendationData.status !==
          "pending" ||
        recommendationData
          .sourceAssignmentId !==
          expected.sourceAssignmentId ||
        recommendationData
          .recommendedDifficulty !==
          expected.recommendedDifficulty ||
        Number(
          recommendationData
            .recommendedMinNumber
        ) !==
          expected.recommendedMinNumber ||
        Number(
          recommendationData
            .recommendedMaxNumber
        ) !==
          expected.recommendedMaxNumber ||
        Number(
          recommendationData
            .questionCount
        ) !==
          expected.questionCount ||
        !sameQuestions(
          currentQuestions,
          expected.previewQuestions
        );

      if (
        recommendationChanged
      ) {
        throw new Error(
          "Recommendation changed. Reopen its preview before reviewing."
        );
      }

      /*
       * =====================
       * APPROVAL CHECKS
       * =====================
       */

      if (
        decision ===
        "approved"
      ) {
        if (
          learnerData.status !==
          "active"
        ) {
          throw new Error(
            "This learner is not active."
          );
        }

        if (
          unfinished(
            previousAssignmentStatus
          )
        ) {
          throw new Error(
            "This learner already has an unfinished activity. Finish it before approving this recommendation."
          );
        }

        if (
          expected.questionCount <
            1 ||
          expected.questionCount >
            100 ||
          expected.previewQuestions
            .length !==
            expected.questionCount ||
          !expected.previewQuestions
            .every(
              validQuestion
            )
        ) {
          throw new Error(
            "Preview unavailable. Reopen learner performance to prepare it."
          );
        }
      }

      /*
       * =====================
       * REVIEW VALUES
       * =====================
       */

      const updates:
        Record<
          string,
          unknown
        > = {
          status:
            decision,

          reviewedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        };

      /*
       * =====================
       * APPROVE
       * =====================
       */

      if (
        decision ===
        "approved"
      ) {
        transaction.set(
          activityReference,
          {
            teacherId:
              user.uid,

            title:
              `${expected.topic} practice`,

            topic:
              expected.topic,

            grade:
              learnerData.grade ??
              "",

            difficulty:
              expected.recommendedDifficulty,

            minNumber:
              expected.recommendedMinNumber,

            maxNumber:
              expected.recommendedMaxNumber,

            questionCount:
              expected.questionCount,

            savedQuestions:
              expected.previewQuestions,

            status:
              "active",

            /*
             * Recommended activities
             * are learner-specific and
             * hidden from the normal
             * activity library.
             */
            libraryVisible:
              false,

            recommendationHistoryId:
              expected.sourceAssignmentId,

            recommendationLearnerId:
              expected.learnerId,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        transaction.set(
          assignmentReference,
          {
            teacherId:
              user.uid,

            learnerId:
              expected.learnerId,

            activityId:
              activityReference.id,

            activityTitle:
              `${expected.topic} practice`,

            topic:
              expected.topic,

            difficulty:
              expected.recommendedDifficulty,

            minNumber:
              expected.recommendedMinNumber,

            maxNumber:
              expected.recommendedMaxNumber,

            totalQuestions:
              expected.questionCount,

            status:
              "assigned",

            score:
              null,

            masteryPercent:
              null,

            recommendationHistoryId:
              expected.sourceAssignmentId,

            assignedAt:
              serverTimestamp(),

            completedAt:
              null,

            updatedAt:
              serverTimestamp(),
          }
        );

        transaction.update(
          learnerReference,
          {
            activeAssignmentId:
              assignmentReference.id,
          }
        );

        updates.activityId =
          activityReference.id;

        updates.assignmentId =
          assignmentReference.id;
      }

      /*
       * =====================
       * UPDATE RECOMMENDATION
       * =====================
       */

      transaction.update(
        recommendationReference,
        updates
      );

      /*
       * Preserve the reviewed
       * recommendation in history.
       */

      transaction.set(
        historyReference,
        {
          ...recommendationData,
          ...updates,
        }
      );
    }
  );
}