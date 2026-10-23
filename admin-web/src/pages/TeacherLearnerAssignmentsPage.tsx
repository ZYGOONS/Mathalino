import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherLearnerAssignmentsPage.css";

interface Learner {
  id: string;

  teacherId: string;

  firstName: string;
  lastName: string;

  status: string;

  activeAssignmentId:
    | string
    | null;

  activeSessionId:
    | string
    | null;
}

interface Activity {
  id: string;

  teacherId: string;

  title: string;
  topic: string;
  difficulty: string;

  questionCount: number;

  minNumber: number;
  maxNumber: number;

  status: string;

  libraryVisible: boolean;
  trashed: boolean;

  recommendationHistoryId:
    | string
    | null;

  recommendationLearnerId:
    | string
    | null;
}

interface Assignment {
  id: string;

  teacherId: string;
  learnerId: string;

  activityId: string;
  activityTitle: string;

  topic: string;
  difficulty: string;

  totalQuestions: number | null;

  status: string;

  currentSessionId:
    | string
    | null;

  assignedAt:
    | Timestamp
    | null;

  recommendationHistoryId:
    | string
    | null;
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

function cancellable(
  assignment:
    Assignment
): boolean {
  return (
    assignment.status ===
      "assigned" &&
    !assignment.currentSessionId
  );
}

function fullName(
  learner:
    Learner | null
): string {
  if (!learner) {
    return "";
  }

  return [
    learner.firstName,
    learner.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatAssignedDate(
  value:
    Timestamp | null
): string {
  if (!value) {
    return "Not recorded";
  }

  return value
    .toDate()
    .toLocaleString(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric",

        year:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit",
      }
    );
}

function TeacherLearnerAssignmentsPage() {
  const navigate =
    useNavigate();

  const {
    learnerId,
  } =
    useParams<{
      learnerId: string;
    }>();

  const [
    learner,
    setLearner,
  ] =
    useState<Learner | null>(
      null
    );

  const [
    activities,
    setActivities,
  ] =
    useState<Activity[]>(
      []
    );

  const [
    assignments,
    setAssignments,
  ] =
    useState<Assignment[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    assignDialogOpen,
    setAssignDialogOpen,
  ] =
    useState(false);

  const [
    selectedActivityId,
    setSelectedActivityId,
  ] =
    useState("");

  const [
    assigning,
    setAssigning,
  ] =
    useState(false);

  const [
    cancellingId,
    setCancellingId,
  ] =
    useState<
      string | null
    >(
      null
    );

  useEffect(() => {
    if (!learnerId) {
      navigate(
        "/teacher/learners"
      );

      return;
    }

    let unsubscribeLearner:
      | (() => void)
      | undefined;

    let unsubscribeActivities:
      | (() => void)
      | undefined;

    let unsubscribeAssignments:
      | (() => void)
      | undefined;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        (
          user
        ) => {
          if (!user) {
            navigate("/");
            return;
          }

          setLoading(
            true
          );

          const learnerReference =
            doc(
              db,
              "learners",
              learnerId
            );

          unsubscribeLearner =
            onSnapshot(
              learnerReference,
              (
                snapshot
              ) => {
                if (
                  !snapshot.exists() ||
                  snapshot.data()
                    .teacherId !==
                    user.uid
                ) {
                  setError(
                    "Learner is unavailable."
                  );

                  return;
                }

                const data =
                  snapshot.data();

                setLearner({
                  id:
                    snapshot.id,

                  teacherId:
                    data.teacherId ??
                    "",

                  firstName:
                    data.firstName ??
                    "",

                  lastName:
                    data.lastName ??
                    "",

                  status:
                    data.status ??
                    "active",

                  activeAssignmentId:
                    data.activeAssignmentId ??
                    null,

                  activeSessionId:
                    data.activeSessionId ??
                    null,
                });

                setLoading(
                  false
                );
              }
            );

          const activitiesQuery =
            query(
              collection(
                db,
                "activities"
              ),
              where(
                "teacherId",
                "==",
                user.uid
              )
            );

          unsubscribeActivities =
            onSnapshot(
              activitiesQuery,
              (
                snapshot
              ) => {
                const list =
                  snapshot.docs
                    .map(
                      (
                        activityDocument
                      ): Activity => {
                        const data =
                          activityDocument.data();

                        return {
                          id:
                            activityDocument.id,

                          teacherId:
                            data.teacherId ??
                            "",

                          title:
                            data.title ??
                            "",

                          topic:
                            data.topic ??
                            "",

                          difficulty:
                            data.difficulty ??
                            "easy",

                          questionCount:
                            Number(
                              data.questionCount ??
                                0
                            ),

                          minNumber:
                            Number(
                              data.minNumber ??
                                0
                            ),

                          maxNumber:
                            Number(
                              data.maxNumber ??
                                10
                            ),

                          status:
                            data.status ??
                            "active",

                          libraryVisible:
                            data.libraryVisible !==
                            false,

                          trashed:
                            data.trashed ===
                            true,

                          recommendationHistoryId:
                            data.recommendationHistoryId ??
                            null,

                          recommendationLearnerId:
                            data.recommendationLearnerId ??
                            null,
                        };
                      }
                    )
                    .filter(
                      (
                        activity
                      ) =>
                        activity.status ===
                          "active" &&
                        activity.libraryVisible &&
                        !activity.trashed
                    );

                setActivities(
                  list
                );
              }
            );

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
                "learnerId",
                "==",
                learnerId
              )
            );

          unsubscribeAssignments =
            onSnapshot(
              assignmentsQuery,
              (
                snapshot
              ) => {
                const list =
                  snapshot.docs
                    .map(
                      (
                        assignmentDocument
                      ): Assignment => {
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

                          topic:
                            data.topic ??
                            "",

                          difficulty:
                            data.difficulty ??
                            "easy",

                          totalQuestions:
                            data.totalQuestions ===
                              null ||
                            data.totalQuestions ===
                              undefined
                              ? null
                              : Number(
                                  data.totalQuestions
                                ),

                          status:
                            data.status ??
                            "",

                          currentSessionId:
                            data.currentSessionId ??
                            null,

                          assignedAt:
                            data.assignedAt ??
                            null,

                          recommendationHistoryId:
                            data.recommendationHistoryId ??
                            null,
                        };
                      }
                    )
                    .sort(
                      (
                        first,
                        second
                      ) =>
                        (
                          second.assignedAt
                            ?.seconds ??
                          0
                        ) -
                        (
                          first.assignedAt
                            ?.seconds ??
                          0
                        )
                    );

                setAssignments(
                  list
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      unsubscribeLearner?.();
      unsubscribeActivities?.();
      unsubscribeAssignments?.();
    };
  }, [
    learnerId,
    navigate,
  ]);

  const unfinishedAssignment =
    useMemo(
      () =>
        assignments.find(
          (
            assignment
          ) =>
            unfinished(
              assignment.status
            )
        ) ??
        null,
      [assignments]
    );

  const selectedActivity =
    activities.find(
      (
        activity
      ) =>
        activity.id ===
        selectedActivityId
    ) ??
    null;

  const handleAssign =
    async () => {
      if (
        !learner ||
        !learnerId ||
        !selectedActivity
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (!user) {
        navigate("/");
        return;
      }

      if (
        unfinishedAssignment
      ) {
        setError(
          `This learner already has an unfinished activity: ${unfinishedAssignment.activityTitle}. Finish it first.`
        );

        return;
      }

      try {
        setAssigning(
          true
        );

        setError(
          ""
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
            const activityReference =
              doc(
                db,
                "activities",
                selectedActivity.id
              );

            const learnerReference =
              doc(
                db,
                "learners",
                learner.id
              );

            const currentActivity =
              await transaction.get(
                activityReference
              );

            const currentLearner =
              await transaction.get(
                learnerReference
              );

            if (
              !currentActivity.exists() ||
              !currentLearner.exists()
            ) {
              throw new Error(
                "Activity or learner is no longer available."
              );
            }

            const activityData =
              currentActivity.data();

            const learnerData =
              currentLearner.data();

            if (
              activityData.teacherId !==
                user.uid ||
              activityData.status !==
                "active" ||
              activityData.trashed ===
                true ||
              activityData.libraryVisible ===
                false ||
              learnerData.teacherId !==
                user.uid ||
              learnerData.status !==
                "active"
            ) {
              throw new Error(
                "Activity or learner is no longer available."
              );
            }

            const previousId =
              learnerData.activeAssignmentId;

            if (previousId) {
              const previousReference =
                doc(
                  db,
                  "assignments",
                  previousId
                );

              const previous =
                await transaction.get(
                  previousReference
                );

              if (
                previous.exists() &&
                unfinished(
                  previous.data()
                    .status
                )
              ) {
                throw new Error(
                  "This learner already has an unfinished activity."
                );
              }
            }

            const assignmentData:
              Record<
                string,
                unknown
              > = {
                teacherId:
                  user.uid,

                learnerId:
                  learner.id,

                activityId:
                  selectedActivity.id,

                activityTitle:
                  selectedActivity.title,

                topic:
                  selectedActivity.topic,

                difficulty:
                  selectedActivity.difficulty,

                minNumber:
                  selectedActivity.minNumber,

                maxNumber:
                  selectedActivity.maxNumber,

                status:
                  "assigned",

                hasStarted:
                  false,

                currentSessionId:
                  null,

                score:
                  null,

                totalQuestions:
                  selectedActivity.questionCount,

                masteryPercent:
                  null,

                assignedAt:
                  serverTimestamp(),

                completedAt:
                  null,

                updatedAt:
                  serverTimestamp(),
              };

            const source =
              activityData.recommendationHistoryId;

            if (
              typeof source ===
                "string" &&
              source
            ) {
              if (
                activityData.recommendationLearnerId !==
                learner.id
              ) {
                throw new Error(
                  "This recommended activity belongs to another learner."
                );
              }

              const historyReference =
                doc(
                  db,
                  "recommendations",
                  learner.id,
                  "history",
                  source
                );

              const history =
                await transaction.get(
                  historyReference
                );

              if (
                !history.exists() ||
                history.data()
                  .teacherId !==
                  user.uid ||
                ![
                  "approved",
                  "adjusted",
                ].includes(
                  history.data()
                    .status
                )
              ) {
                throw new Error(
                  "Approved recommendation history is unavailable."
                );
              }

              assignmentData.recommendationHistoryId =
                source;
            }

            transaction.update(
              learnerReference,
              {
                activeAssignmentId:
                  assignmentReference.id,
              }
            );

            transaction.update(
              activityReference,
              {
                assignmentRevision:
                  increment(
                    1
                  ),
              }
            );

            transaction.set(
              assignmentReference,
              assignmentData
            );
          }
        );

        setAssignDialogOpen(
          false
        );

        setSelectedActivityId(
          ""
        );
      } catch (
        assignError
      ) {
        console.error(
          "Could not assign activity:",
          assignError
        );

        setError(
          assignError instanceof
          Error
            ? assignError.message
            : "Could not assign activity."
        );
      } finally {
        setAssigning(
          false
        );
      }
    };

  const handleCancel =
    async (
      assignment:
        Assignment
    ) => {
      if (
        !cancellable(
          assignment
        )
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (!user) {
        navigate("/");
        return;
      }

      try {
        setCancellingId(
          assignment.id
        );

        setError(
          ""
        );

        await runTransaction(
          db,
          async (
            transaction
          ) => {
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

            if (
              !currentAssignment.exists() ||
              currentAssignment.data()
                .teacherId !==
                user.uid
            ) {
              throw new Error(
                "Assignment unavailable."
              );
            }

            const assignmentData =
              currentAssignment.data();

            if (
              assignmentData.status !==
                "assigned" ||
              assignmentData.currentSessionId
            ) {
              throw new Error(
                "Stop the live session before cancelling this assignment."
              );
            }

            const learnerReference =
              doc(
                db,
                "learners",
                assignmentData.learnerId
              );

            const currentLearner =
              await transaction.get(
                learnerReference
              );

            if (
              !currentLearner.exists() ||
              currentLearner.data()
                .teacherId !==
                user.uid
            ) {
              throw new Error(
                "Learner unavailable."
              );
            }

            const activeSessionId =
              currentLearner.data()
                .activeSessionId;

            if (
              activeSessionId
            ) {
              const session =
                await transaction.get(
                  doc(
                    db,
                    "liveSessions",
                    activeSessionId
                  )
                );

              if (
                session.exists() &&
                session.data()
                  .status ===
                  "active"
              ) {
                throw new Error(
                  "Stop the live session first."
                );
              }
            }

            transaction.update(
              assignmentReference,
              {
                status:
                  "cancelled",

                cancelledAt:
                  serverTimestamp(),

                updatedAt:
                  serverTimestamp(),
              }
            );

            if (
              currentLearner.data()
                .activeAssignmentId ===
              assignment.id
            ) {
              transaction.update(
                learnerReference,
                {
                  activeAssignmentId:
                    null,
                }
              );
            }
          }
        );
      } catch (
        cancelError
      ) {
        console.error(
          "Could not cancel assignment:",
          cancelError
        );

        setError(
          cancelError instanceof
          Error
            ? cancelError.message
            : "Could not cancel assignment."
        );
      } finally {
        setCancellingId(
          null
        );
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-assignments-heading">

        <div>

          <button
            type="button"
            className="teacher-assignments-back"
            onClick={() =>
              navigate(
                `/teacher/learners/${learnerId}`
              )
            }
          >
            ← Learner Details
          </button>

          <span className="teacher-assignments-eyebrow">
            LEARNER ACTIVITIES
          </span>

          <h2>
            Assigned Activities
          </h2>

          <p>
            {learner
              ? `Manage activities assigned to ${fullName(
                  learner
                )}.`
              : "Manage learner activities."}
          </p>

        </div>

        <button
          type="button"
          className="teacher-assign-button"
          disabled={
            !learner ||
            learner.status !==
              "active" ||
            Boolean(
              unfinishedAssignment
            )
          }
          onClick={() => {
            setError(
              ""
            );

            setAssignDialogOpen(
              true
            );
          }}
        >
          + Assign Activity
        </button>

      </div>

      {error && (
        <div
          className="teacher-assignments-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="teacher-assignments-loading">
          Loading assignments...
        </div>
      )}

      {!loading &&
        learner &&
        unfinishedAssignment && (
          <section className="teacher-assignment-current">

            <div className="teacher-assignment-status-line">

              <span
                className={
                  unfinishedAssignment.status ===
                  "in_progress"
                    ? "teacher-assignment-status progress"
                    : "teacher-assignment-status ready"
                }
              >
                {unfinishedAssignment.status ===
                "in_progress"
                  ? "IN PROGRESS"
                  : "READY TO START"}
              </span>

            </div>

            <h3>
              {
                unfinishedAssignment.activityTitle
              }
            </h3>

            <div className="teacher-assignment-meta">

              <span>
                {
                  unfinishedAssignment.topic
                }
              </span>

              <span>
                {unfinishedAssignment.totalQuestions ??
                  "—"}{" "}
                questions
              </span>

              <span>
                {unfinishedAssignment.difficulty
                  .charAt(
                    0
                  )
                  .toUpperCase() +
                  unfinishedAssignment.difficulty.slice(
                    1
                  )}
              </span>

            </div>

            {unfinishedAssignment.recommendationHistoryId && (
              <p className="teacher-assignment-recommendation">
                From an approved
                recommendation
              </p>
            )}

            <p className="teacher-assignment-date">
              Assigned:{" "}
              {formatAssignedDate(
                unfinishedAssignment.assignedAt
              )}
            </p>

            <div className="teacher-assignment-instruction">

              {unfinishedAssignment.status ===
              "assigned"
                ? "Tap the learner's card on an available Smart Board to begin."
                : "Learning now · follow along in Live Sessions."}

            </div>

            {cancellable(
              unfinishedAssignment
            ) && (
              <button
                type="button"
                className="teacher-assignment-cancel"
                disabled={
                  cancellingId ===
                  unfinishedAssignment.id
                }
                onClick={() => {
                  void handleCancel(
                    unfinishedAssignment
                  );
                }}
              >
                {cancellingId ===
                unfinishedAssignment.id
                  ? "Cancelling..."
                  : "Cancel Assignment"}
              </button>
            )}

          </section>
        )}

      {!loading &&
        learner &&
        !unfinishedAssignment && (
          <section className="teacher-assignments-empty">

            <h3>
              No activity assigned
            </h3>

            <p>
              Ready for the next
              activity. Assign one from
              the teacher's activity
              library.
            </p>

            <button
              type="button"
              disabled={
                learner.status !==
                "active"
              }
              onClick={() =>
                setAssignDialogOpen(
                  true
                )
              }
            >
              Assign an Activity
            </button>

          </section>
        )}

      {/* ASSIGN MODAL */}

      {assignDialogOpen && (
        <div className="teacher-assignment-modal-backdrop">

          <div className="teacher-assignment-modal">

            <span className="teacher-assignment-modal-label">
              NEW ASSIGNMENT
            </span>

            <h3>
              Assign Activity
            </h3>

            <p>
              Choose an active activity
              for{" "}
              <strong>
                {fullName(
                  learner
                )}
              </strong>
              .
            </p>

            <label htmlFor="activity-select">
              ACTIVITY
            </label>

            <select
              id="activity-select"
              value={
                selectedActivityId
              }
              disabled={
                assigning
              }
              onChange={(
                event
              ) =>
                setSelectedActivityId(
                  event.target.value
                )
              }
            >
              <option value="">
                Select activity
              </option>

              {activities.map(
                (
                  activity
                ) => (
                  <option
                    key={
                      activity.id
                    }
                    value={
                      activity.id
                    }
                  >
                    {
                      activity.title
                    }
                  </option>
                )
              )}

            </select>

            {selectedActivity && (
              <div className="teacher-assignment-preview">

                <strong>
                  {
                    selectedActivity.title
                  }
                </strong>

                <span>
                  {
                    selectedActivity.topic
                  }
                </span>

                <span>
                  {
                    selectedActivity.questionCount
                  }{" "}
                  questions
                </span>

                <span>
                  {
                    selectedActivity.difficulty
                  }
                </span>

                <span>
                  Range:{" "}
                  {
                    selectedActivity.minNumber
                  }
                  –
                  {
                    selectedActivity.maxNumber
                  }
                </span>

              </div>
            )}

            {activities.length ===
              0 && (
              <div className="teacher-assignment-no-activities">
                No active activities are
                available.
              </div>
            )}

            <div className="teacher-assignment-modal-actions">

              <button
                type="button"
                className="teacher-assignment-modal-cancel"
                disabled={
                  assigning
                }
                onClick={() => {
                  setAssignDialogOpen(
                    false
                  );

                  setSelectedActivityId(
                    ""
                  );
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="teacher-assignment-modal-confirm"
                disabled={
                  assigning ||
                  !selectedActivity
                }
                onClick={() => {
                  void handleAssign();
                }}
              >
                {assigning
                  ? "Assigning..."
                  : "Confirm Assignment"}
              </button>

            </div>

          </div>

        </div>
      )}

    </TeacherLayout>
  );
}

export default TeacherLearnerAssignmentsPage;