import {
  useEffect,
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
  doc,
  onSnapshot,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import {
  setActivityTrashed,
} from "../services/activityTrash";

import "./TeacherActivityDetailsPage.css";

interface Activity {
  id: string;

  teacherId: string;

  title: string;

  description: string;

  topic: string;

  grade: string;

  difficulty: string;

  minNumber: number;
  maxNumber: number;

  questionCount: number;

  savedQuestionsCount: number;

  status: string;

  trashed: boolean;
}

function difficultyLabel(
  difficulty: string
): string {
  switch (
    difficulty.toLowerCase()
  ) {
    case "easy":
      return "Easy";

    case "average":
      return "Average";

    case "difficult":
      return "Difficult";

    default:
      return difficulty ||
        "—";
  }
}

function statusLabel(
  status: string
): string {
  switch (
    status.toLowerCase()
  ) {
    case "active":
      return "Active";

    case "archived":
      return "Archived";

    default:
      return status ||
        "Unknown";
  }
}

function TeacherActivityDetailsPage() {
  const navigate =
    useNavigate();

  const {
    activityId,
  } =
    useParams<{
      activityId: string;
    }>();

  const [
    activity,
    setActivity,
  ] =
    useState<Activity | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    updatingTrash,
    setUpdatingTrash,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    actionError,
    setActionError,
  ] =
    useState("");

  /*
   * =========================
   * LOAD
   * =========================
   */

  useEffect(() => {
    if (!activityId) {
      navigate(
        "/teacher/activities"
      );

      return;
    }

    let unsubscribeActivity:
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

          const activityReference =
            doc(
              db,
              "activities",
              activityId
            );

          unsubscribeActivity =
            onSnapshot(
              activityReference,
              (
                snapshot
              ) => {
                if (
                  !snapshot.exists()
                ) {
                  setActivity(
                    null
                  );

                  setError(
                    "Activity was not found."
                  );

                  setLoading(
                    false
                  );

                  return;
                }

                const data =
                  snapshot.data();

                if (
                  data.teacherId !==
                  user.uid
                ) {
                  setActivity(
                    null
                  );

                  setError(
                    "This activity does not belong to your account."
                  );

                  setLoading(
                    false
                  );

                  return;
                }

                setActivity({
                  id:
                    snapshot.id,

                  teacherId:
                    data.teacherId ??
                    "",

                  title:
                    data.title ??
                    "",

                  description:
                    data.description ??
                    "",

                  topic:
                    data.topic ??
                    "",

                  grade:
                    data.grade ??
                    "",

                  difficulty:
                    data.difficulty ??
                    "",

                  minNumber:
                    Number(
                      data.minNumber ??
                        0
                    ),

                  maxNumber:
                    Number(
                      data.maxNumber ??
                        0
                    ),

                  questionCount:
                    Number(
                      data.questionCount ??
                        0
                    ),

                  savedQuestionsCount:
                    Array.isArray(
                      data.savedQuestions
                    )
                      ? data.savedQuestions.length
                      : 0,

                  status:
                    data.status ??
                    "active",

                  trashed:
                    data.trashed ===
                    true,
                });

                setError(
                  ""
                );

                setLoading(
                  false
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  "Could not load activity:",
                  snapshotError
                );

                setActivity(
                  null
                );

                setError(
                  "Could not load activity details."
                );

                setLoading(
                  false
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      unsubscribeActivity?.();
    };
  }, [
    activityId,
    navigate,
  ]);

  /*
   * =========================
   * TRASH / RESTORE
   * =========================
   */

  const handleTrashToggle =
    async () => {
      if (
        !activity
      ) {
        return;
      }

      const trash =
        !activity.trashed;

      const confirmed =
        window.confirm(
          trash
            ? `${activity.title} will be hidden from the library and new assignments. Existing assignments and results will stay saved. You can restore it from Trash.\n\nMove to Trash?`
            : `${activity.title} will return to the Activity Library.\n\nRestore activity?`
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setUpdatingTrash(
          true
        );

        setActionError(
          ""
        );

        await setActivityTrashed(
          activity.id,
          trash
        );

        if (trash) {
          navigate(
            "/teacher/activities"
          );
        }
      } catch (
        trashError
      ) {
        console.error(
          "Could not update activity:",
          trashError
        );

        setActionError(
          trashError instanceof
          Error
            ? trashError.message
            : "Could not update activity."
        );
      } finally {
        setUpdatingTrash(
          false
        );
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-activity-details-heading">

        <button
          type="button"
          className="teacher-activity-details-back"
          onClick={() =>
            navigate(
              "/teacher/activities"
            )
          }
        >
          ← Activities
        </button>

        <span className="teacher-activity-details-eyebrow">
          ACTIVITY MANAGEMENT
        </span>

        <h2>
          Activity Details
        </h2>

        <p>
          Review this mathematics activity
          and manage its content.
        </p>

      </div>

      {error && (
        <div
          className="teacher-activity-details-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {actionError && (
        <div
          className="teacher-activity-details-error"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {loading && (
        <div className="teacher-activity-details-loading">
          Loading activity...
        </div>
      )}

      {!loading &&
        activity && (
          <>

            {/* ACTIVITY */}

            <section className="teacher-activity-details-card">

              <div className="teacher-activity-details-title-row">

                <div>

                  <span className="teacher-activity-details-topic">
                    {activity.topic ||
                      "TOPIC NOT SET"}
                  </span>

                  <h3>
                    {activity.title ||
                      "Untitled Activity"}
                  </h3>

                </div>

                <span
                  className={`teacher-activity-details-status ${
                    activity.trashed
                      ? "archived"
                      : activity.status
                  }`}
                >
                  {activity.trashed
                    ? "In Trash"
                    : statusLabel(
                        activity.status
                      )}
                </span>

              </div>

              <div className="teacher-activity-details-description">

                <span>
                  DESCRIPTION
                </span>

                <p>
                  {activity.description ||
                    "No description has been added for this activity."}
                </p>

              </div>

              <div className="teacher-activity-details-grid">

                <div>
                  <span>
                    TOPIC
                  </span>

                  <strong>
                    {activity.topic ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    GRADE LEVEL
                  </span>

                  <strong>
                    {activity.grade ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    DIFFICULTY
                  </span>

                  <strong>
                    {difficultyLabel(
                      activity.difficulty
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    NUMBER RANGE
                  </span>

                  <strong>
                    {
                      activity.minNumber
                    }
                    –
                    {
                      activity.maxNumber
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    QUESTIONS
                  </span>

                  <strong>
                    {
                      activity.questionCount
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    SAVED QUESTIONS
                  </span>

                  <strong>
                    {
                      activity.savedQuestionsCount
                    }
                    {" / "}
                    {
                      activity.questionCount
                    }
                  </strong>
                </div>

              </div>

            </section>

            {/* QUESTIONS */}

            <section className="teacher-activity-details-card teacher-activity-question-summary">

              <div className="teacher-activity-details-section-heading">

                <span>
                  QUESTION CONTENT
                </span>

                <h3>
                  Activity Questions
                </h3>

              </div>

              <div className="teacher-activity-question-state">

                <div>

                  <strong>
                    {
                      activity.savedQuestionsCount
                    }{" "}
                    saved
                  </strong>

                  <span>
                    of{" "}
                    {
                      activity.questionCount
                    }{" "}
                    questions
                  </span>

                </div>

                <div className="teacher-activity-question-progress">

                  <div
                    style={{
                      width:
                        activity.questionCount >
                        0
                          ? `${Math.min(
                              100,
                              Math.round(
                                (
                                  activity.savedQuestionsCount /
                                  activity.questionCount
                                ) *
                                  100
                              )
                            )}%`
                          : "0%",
                    }}
                  />

                </div>

              </div>

              <p>
                Preview Questions lets
                you generate, review and
                save the exact question
                set used by this
                activity.
              </p>

            </section>

            {/* ACTIONS */}

            <section className="teacher-activity-details-actions-card">

              <div className="teacher-activity-details-section-heading">

                <span>
                  ACTIVITY ACTIONS
                </span>

                <h3>
                  Manage Activity
                </h3>

              </div>

              <div className="teacher-activity-details-actions">

                <button
                  type="button"
                  className="teacher-activity-details-action primary"
                  disabled={
                    updatingTrash
                  }
                  onClick={() =>
                    navigate(
                      `/teacher/activities/${activity.id}/edit`
                    )
                  }
                >
                  <strong>
                    Edit Activity
                  </strong>

                  <span>
                    Update title, topic,
                    grade, difficulty and
                    question settings.
                  </span>
                </button>

                <button
                  type="button"
                  className="teacher-activity-details-action"
                  disabled={
                    updatingTrash
                  }
                  onClick={() =>
                    navigate(
                      `/teacher/activities/${activity.id}/questions`
                    )
                  }
                >
                  <strong>
                    Preview Questions
                  </strong>

                  <span>
                    Generate and review the
                    activity questions.
                  </span>
                </button>

                <button
                  type="button"
                  className={`teacher-activity-details-action ${
                    activity.trashed
                      ? "primary"
                      : "danger"
                  }`}
                  disabled={
                    updatingTrash
                  }
                  onClick={() => {
                    void handleTrashToggle();
                  }}
                >
                  <strong>
                    {updatingTrash
                      ? "Updating..."
                      : activity.trashed
                        ? "Restore Activity"
                        : "Move to Trash"}
                  </strong>

                  <span>
                    {activity.trashed
                      ? "Return this activity to the active Activity Library."
                      : "Hide this activity from the library and prevent new assignments."}
                  </span>

                </button>

              </div>

            </section>

          </>
        )}

    </TeacherLayout>
  );
}

export default TeacherActivityDetailsPage;