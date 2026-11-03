import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
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
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherAssignActivityPage.css";

interface Learner {
  id: string;

  teacherId: string;

  firstName: string;
  lastName: string;

  grade: string;
  section: string;

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

  grade: string;

  questionCount: number;

  minNumber: number;
  maxNumber: number;

  status: string;

  libraryVisible: boolean;

  trashed: boolean;

  savedQuestionCount:
    number;

  recommendationHistoryId:
    | string
    | null;

  recommendationLearnerId:
    | string
    | null;
}

interface Assignment {
  id: string;

  learnerId: string;

  activityTitle: string;

  status: string;
}

function fullName(
  learner:
    Learner
): string {
  return [
    learner.firstName,
    learner.lastName,
  ]
    .filter(Boolean)
    .join(" ");
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

function difficultyLabel(
  value: string
): string {
  if (!value) {
    return "—";
  }

  return (
    value
      .charAt(0)
      .toUpperCase() +
    value.slice(1)
  );
}

function TeacherAssignActivityPage() {
  const navigate =
    useNavigate();

  const [
    learners,
    setLearners,
  ] =
    useState<Learner[]>(
      []
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
    selectedLearnerId,
    setSelectedLearnerId,
  ] =
    useState("");

  const [
    selectedActivityId,
    setSelectedActivityId,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    assigning,
    setAssigning,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    let unsubscribeLearners:
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

          const learnersQuery =
            query(
              collection(
                db,
                "learners"
              ),

              where(
                "teacherId",
                "==",
                user.uid
              )
            );

          unsubscribeLearners =
            onSnapshot(
              learnersQuery,
              (
                snapshot
              ) => {
                const list =
                  snapshot.docs
                    .map(
                      (
                        learnerDocument
                      ): Learner => {
                        const data =
                          learnerDocument.data();

                        return {
                          id:
                            learnerDocument.id,

                          teacherId:
                            data.teacherId ??
                            "",

                          firstName:
                            data.firstName ??
                            "",

                          lastName:
                            data.lastName ??
                            "",

                          grade:
                            String(
                              data.grade ??
                                ""
                            ),

                          section:
                            data.section ??
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
                        };
                      }
                    )
                    .filter(
                      (
                        learner
                      ) =>
                        learner.status ===
                        "active"
                    )
                    .sort(
                      (
                        first,
                        second
                      ) =>
                        fullName(
                          first
                        ).localeCompare(
                          fullName(
                            second
                          )
                        )
                    );

                setLearners(
                  list
                );

                setLoading(
                  false
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  "Could not load learners:",
                  snapshotError
                );

                setError(
                  "Could not load learners."
                );

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

                        const savedQuestions =
                          Array.isArray(
                            data.savedQuestions
                          )
                            ? data.savedQuestions
                            : [];

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

                          grade:
                            String(
                              data.grade ??
                                ""
                            ),

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

                          savedQuestionCount:
                            savedQuestions.length,

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
                        !activity.trashed &&
                        activity.questionCount >
                          0 &&
                        activity.savedQuestionCount ===
                          activity.questionCount
                    )
                    .sort(
                      (
                        first,
                        second
                      ) =>
                        first.title.localeCompare(
                          second.title
                        )
                    );

                setActivities(
                  list
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  "Could not load activities:",
                  snapshotError
                );

                setError(
                  "Could not load activities."
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
              )
            );

          unsubscribeAssignments =
            onSnapshot(
              assignmentsQuery,
              (
                snapshot
              ) => {
                const list =
                  snapshot.docs.map(
                    (
                      assignmentDocument
                    ): Assignment => {
                      const data =
                        assignmentDocument.data();

                      return {
                        id:
                          assignmentDocument.id,

                        learnerId:
                          data.learnerId ??
                          "",

                        activityTitle:
                          data.activityTitle ??
                          "",

                        status:
                          data.status ??
                          "",
                      };
                    }
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

      unsubscribeLearners?.();

      unsubscribeActivities?.();

      unsubscribeAssignments?.();
    };
  }, [
    navigate,
  ]);

  const selectedLearner =
    useMemo(
      () =>
        learners.find(
          (
            learner
          ) =>
            learner.id ===
            selectedLearnerId
        ) ??
        null,
      [
        learners,
        selectedLearnerId,
      ]
    );

  const selectedActivity =
    useMemo(
      () =>
        activities.find(
          (
            activity
          ) =>
            activity.id ===
            selectedActivityId
        ) ??
        null,
      [
        activities,
        selectedActivityId,
      ]
    );

  const learnerUnfinishedAssignment =
    useMemo(
      () => {
        if (
          !selectedLearnerId
        ) {
          return null;
        }

        return (
          assignments.find(
            (
              assignment
            ) =>
              assignment.learnerId ===
                selectedLearnerId &&
              unfinished(
                assignment.status
              )
          ) ??
          null
        );
      },
      [
        assignments,
        selectedLearnerId,
      ]
    );

  const availableActivities =
    useMemo(
      () => {
        if (
          !selectedLearner
        ) {
          return [];
        }

        return activities.filter(
          (
            activity
          ) => {
            if (
              activity.recommendationHistoryId &&
              activity.recommendationLearnerId &&
              activity.recommendationLearnerId !==
                selectedLearner.id
            ) {
              return false;
            }

            return true;
          }
        );
      },
      [
        activities,
        selectedLearner,
      ]
    );

  useEffect(
    () => {
      setSelectedActivityId(
        ""
      );

      setError(
        ""
      );
    },
    [
      selectedLearnerId,
    ]
  );

  const handleAssign =
    async () => {
      if (
        !selectedLearner ||
        !selectedActivity
      ) {
        setError(
          "Select a learner and an activity."
        );

        return;
      }

      if (
        learnerUnfinishedAssignment
      ) {
        setError(
          `${fullName(
            selectedLearner
          )} already has an unfinished activity: ${learnerUnfinishedAssignment.activityTitle}.`
        );

        return;
      }

      const user =
        auth.currentUser;

      if (!user) {
        navigate("/");

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
            const learnerReference =
              doc(
                db,
                "learners",
                selectedLearner.id
              );

            const activityReference =
              doc(
                db,
                "activities",
                selectedActivity.id
              );

            const currentLearner =
              await transaction.get(
                learnerReference
              );

            const currentActivity =
              await transaction.get(
                activityReference
              );

            if (
              !currentLearner.exists() ||
              !currentActivity.exists()
            ) {
              throw new Error(
                "Learner or activity is no longer available."
              );
            }

            const learnerData =
              currentLearner.data();

            const activityData =
              currentActivity.data();

            if (
              learnerData.teacherId !==
                user.uid ||
              learnerData.status !==
                "active"
            ) {
              throw new Error(
                "This learner is no longer available."
              );
            }

            if (
              learnerData.activeSessionId
            ) {
              throw new Error(
                "This learner currently has an active learning session."
              );
            }

            if (
              activityData.teacherId !==
                user.uid ||
              activityData.status !==
                "active" ||
              activityData.trashed ===
                true ||
              activityData.libraryVisible ===
                false
            ) {
              throw new Error(
                "This activity is no longer available."
              );
            }

            const savedQuestions =
              Array.isArray(
                activityData.savedQuestions
              )
                ? activityData.savedQuestions
                : [];

            const questionCount =
              Number(
                activityData.questionCount ??
                  0
              );

            if (
              questionCount <
                1 ||
              savedQuestions.length !==
                questionCount
            ) {
              throw new Error(
                "This activity does not have a complete saved question set."
              );
            }

            const previousAssignmentId =
              learnerData.activeAssignmentId;

            if (
              previousAssignmentId
            ) {
              const previousReference =
                doc(
                  db,
                  "assignments",
                  previousAssignmentId
                );

              const previousAssignment =
                await transaction.get(
                  previousReference
                );

              if (
                previousAssignment.exists() &&
                unfinished(
                  previousAssignment.data()
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
                  selectedLearner.id,

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

                totalQuestions:
                  selectedActivity.questionCount,

                status:
                  "assigned",

                hasStarted:
                  false,

                currentSessionId:
                  null,

                score:
                  null,

                masteryPercent:
                  null,

                assignedAt:
                  serverTimestamp(),

                completedAt:
                  null,

                updatedAt:
                  serverTimestamp(),
              };

            const recommendationHistoryId =
              activityData.recommendationHistoryId;

            if (
              typeof recommendationHistoryId ===
                "string" &&
              recommendationHistoryId
            ) {
              if (
                activityData.recommendationLearnerId !==
                selectedLearner.id
              ) {
                throw new Error(
                  "This recommended activity belongs to another learner."
                );
              }

              const historyReference =
                doc(
                  db,
                  "recommendations",
                  selectedLearner.id,
                  "history",
                  recommendationHistoryId
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
                recommendationHistoryId;
            }

            transaction.set(
              assignmentReference,
              assignmentData
            );

            transaction.update(
              learnerReference,
              {
                activeAssignmentId:
                  assignmentReference.id,

                updatedAt:
                  serverTimestamp(),
              }
            );

            transaction.update(
              activityReference,
              {
                assignmentRevision:
                  increment(
                    1
                  ),

                updatedAt:
                  serverTimestamp(),
              }
            );
          }
        );

        navigate(
          `/teacher/learners/${selectedLearner.id}/assignments`
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

  if (
    loading
  ) {
    return (
      <TeacherLayout>

        <div className="teacher-assign-page-loading">
          Loading learners and activities...
        </div>

      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>

      <div className="teacher-assign-page-heading">

        <span className="teacher-assign-page-eyebrow">
          LEARNER ACTIVITIES
        </span>

        <h2>
          Assign Activity
        </h2>

        <p>
          Choose a learner and an available activity to assign.
        </p>

      </div>

      {error && (
        <div
          className="teacher-assign-page-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="teacher-assign-page-card">

        <div className="teacher-assign-page-section-heading">

          <span>
            ASSIGNMENT DETAILS
          </span>

          <h3>
            Select Learner & Activity
          </h3>

          <p>
            A learner can only have one unfinished activity at a time.
          </p>

        </div>

        <div className="teacher-assign-page-grid">

          <div className="teacher-assign-page-field">

            <label htmlFor="assign-learner">
              LEARNER
            </label>

            <select
              id="assign-learner"
              value={
                selectedLearnerId
              }
              disabled={
                assigning
              }
              onChange={(
                event
              ) =>
                setSelectedLearnerId(
                  event.target.value
                )
              }
            >

              <option value="">
                Select learner
              </option>

              {learners.map(
                (
                  learner
                ) => (
                  <option
                    key={
                      learner.id
                    }
                    value={
                      learner.id
                    }
                  >
                    {fullName(
                      learner
                    )}
                    {learner.grade
                      ? ` — Grade ${learner.grade}`
                      : ""}
                    {learner.section
                      ? ` ${learner.section}`
                      : ""}
                  </option>
                )
              )}

            </select>

            {learners.length ===
              0 && (
              <small>
                No active learners are available.
              </small>
            )}

          </div>

          <div className="teacher-assign-page-field">

            <label htmlFor="assign-activity">
              ACTIVITY
            </label>

            <select
              id="assign-activity"
              value={
                selectedActivityId
              }
              disabled={
                assigning ||
                !selectedLearner ||
                Boolean(
                  learnerUnfinishedAssignment
                )
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
                {selectedLearner
                  ? "Select activity"
                  : "Select learner first"}
              </option>

              {availableActivities.map(
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

            {selectedLearner &&
              availableActivities.length ===
                0 &&
              !learnerUnfinishedAssignment && (
                <small>
                  No saved activities are available for this learner.
                </small>
              )}

          </div>

        </div>

        {selectedLearner && (
          <div className="teacher-assign-page-learner-preview">

            <div>

              <span>
                SELECTED LEARNER
              </span>

              <strong>
                {fullName(
                  selectedLearner
                )}
              </strong>

            </div>

            <div>

              <span>
                GRADE
              </span>

              <strong>
                {selectedLearner.grade ||
                  "—"}
              </strong>

            </div>

            <div>

              <span>
                SECTION
              </span>

              <strong>
                {selectedLearner.section ||
                  "—"}
              </strong>

            </div>

          </div>
        )}

        {selectedLearner &&
          learnerUnfinishedAssignment && (
            <div className="teacher-assign-page-warning">

              <strong>
                Assignment unavailable
              </strong>

              <p>
                {fullName(
                  selectedLearner
                )}{" "}
                already has an unfinished activity:{" "}
                <strong>
                  {
                    learnerUnfinishedAssignment.activityTitle
                  }
                </strong>
                . Complete or cancel it before assigning another activity.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/teacher/learners/${selectedLearner.id}/assignments`
                  )
                }
              >
                View Assigned Activity
              </button>

            </div>
          )}

        {selectedActivity &&
          !learnerUnfinishedAssignment && (
            <div className="teacher-assign-page-activity-preview">

              <div className="teacher-assign-page-preview-heading">

                <div>

                  <span>
                    SELECTED ACTIVITY
                  </span>

                  <h4>
                    {
                      selectedActivity.title
                    }
                  </h4>

                </div>

                <span className="teacher-assign-page-ready">
                  READY
                </span>

              </div>

              <div className="teacher-assign-page-preview-grid">

                <div>

                  <span>
                    TOPIC
                  </span>

                  <strong>
                    {
                      selectedActivity.topic
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    DIFFICULTY
                  </span>

                  <strong>
                    {difficultyLabel(
                      selectedActivity.difficulty
                    )}
                  </strong>

                </div>

                <div>

                  <span>
                    QUESTIONS
                  </span>

                  <strong>
                    {
                      selectedActivity.questionCount
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    RANGE
                  </span>

                  <strong>
                    {
                      selectedActivity.minNumber
                    }
                    –
                    {
                      selectedActivity.maxNumber
                    }
                  </strong>

                </div>

              </div>

            </div>
          )}

        <div className="teacher-assign-page-actions">

          <button
            type="button"
            className="teacher-assign-page-cancel"
            disabled={
              assigning
            }
            onClick={() =>
              navigate(
                "/teacher/learners"
              )
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="teacher-assign-page-confirm"
            disabled={
              assigning ||
              !selectedLearner ||
              !selectedActivity ||
              Boolean(
                learnerUnfinishedAssignment
              )
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

      </section>

    </TeacherLayout>
  );
}

export default TeacherAssignActivityPage;