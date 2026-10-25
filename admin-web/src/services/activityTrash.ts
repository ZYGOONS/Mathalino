import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

function unfinished(
  status: unknown
): boolean {
  return (
    status ===
      "assigned" ||
    status ===
      "in_progress"
  );
}

export async function setActivityTrashed(
  activityId: string,
  trash: boolean
): Promise<void> {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Sign in again."
    );
  }

  const activityReference =
    doc(
      db,
      "activities",
      activityId
    );

  /*
   * Read the activity before checking
   * assignments. We remember the
   * revision so we can detect an
   * assignment created during this
   * operation.
   */
  const before =
    await getDoc(
      activityReference
    );

  if (
    !before.exists()
  ) {
    throw new Error(
      "Activity unavailable."
    );
  }

  const beforeData =
    before.data();

  if (
    beforeData.teacherId !==
    user.uid
  ) {
    throw new Error(
      "Activity unavailable."
    );
  }

  if (
    beforeData.libraryVisible ===
    false
  ) {
    throw new Error(
      "Activity unavailable."
    );
  }

  const revision =
    Number(
      beforeData.assignmentRevision ??
        0
    );

  /*
   * Android rule:
   * an activity cannot be moved to
   * Trash while an assignment is
   * assigned or in_progress.
   */
  if (trash) {
    const assignmentsQuery =
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
          "activityId",
          "==",
          activityId
        )
      );

    const assignments =
      await getDocs(
        assignmentsQuery
      );

    const hasUnfinished =
      assignments.docs.some(
        (
          assignment
        ) =>
          unfinished(
            assignment.data()
              .status
          )
      );

    if (
      hasUnfinished
    ) {
      throw new Error(
        "This activity is assigned to a learner. Complete or cancel all current assignments before moving it to Trash."
      );
    }
  }

  /*
   * Final transaction protects against
   * a simultaneous assignment.
   */
  await runTransaction(
    db,
    async (
      transaction
    ) => {
      const current =
        await transaction.get(
          activityReference
        );

      const currentUser =
        auth.currentUser;

      if (
        !current.exists() ||
        !currentUser ||
        currentUser.uid !==
          user.uid
      ) {
        throw new Error(
          "Activity unavailable."
        );
      }

      const currentData =
        current.data();

      if (
        currentData.teacherId !==
          user.uid ||
        currentData.libraryVisible ===
          false
      ) {
        throw new Error(
          "Activity unavailable."
        );
      }

      if (
        trash &&
        Number(
          currentData.assignmentRevision ??
            0
        ) !== revision
      ) {
        throw new Error(
          "Assignments changed. Please try again."
        );
      }

      transaction.update(
        activityReference,
        {
          trashed:
            trash,

          updatedAt:
            serverTimestamp(),
        }
      );
    }
  );
}