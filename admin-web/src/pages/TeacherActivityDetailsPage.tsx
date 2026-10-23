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
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

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

  libraryVisible: boolean;

  trashed: boolean;

  assignmentRevision: number;

  createdAt:
    | Timestamp
    | null;

  updatedAt:
    | Timestamp
    | null;
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
      return difficulty || "—";
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
      return status || "Unknown";
  }
}

function formatDate(
  timestamp:
    Timestamp | null
): string {
  if (!timestamp) {
    return "Not recorded";
  }

  return timestamp
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
    error,
    setError,
  ] =
    useState("");

  /*
   * =========================
   * LOAD ACTIVITY
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

                  libraryVisible:
                    data.libraryVisible !==
                    false,

                  trashed:
                    data.trashed ===
                    true,

                  assignmentRevision:
                    Number(
                      data.assignmentRevision ??
                        0
                    ),

                  createdAt:
                    data.createdAt ??
                    null,

                  updatedAt:
                    data.updatedAt ??
                    null,
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
          Review this mathematics
          activity and manage its
          content.
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

      {loading && (
        <div className="teacher-activity-details-loading">
          Loading activity...
        </div>
      )}

      {!loading &&
        activity && (
          <>

            {/* MAIN INFORMATION */}

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
                  className={`teacher-activity-details-status ${activity.status}`}
                >
                  {statusLabel(
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

            {/* QUESTION INFORMATION */}

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
                Questions are generated
                when needed by the
                Mathalino activity
                generator. The upcoming
                Question Preview feature
                will allow you to inspect
                and save generated
                questions before assigning
                the activity.
              </p>

            </section>

            {/* SYSTEM INFORMATION */}

            <section className="teacher-activity-details-card">

              <div className="teacher-activity-details-section-heading">

                <span>
                  ACTIVITY RECORD
                </span>

                <h3>
                  System Information
                </h3>

              </div>

              <div className="teacher-activity-system-grid">

                <div>

                  <span>
                    STATUS
                  </span>

                  <strong>
                    {statusLabel(
                      activity.status
                    )}
                  </strong>

                </div>

                <div>

                  <span>
                    LIBRARY
                  </span>

                  <strong>
                    {activity.libraryVisible
                      ? "Visible"
                      : "Hidden"}
                  </strong>

                </div>

                <div>

                  <span>
                    ASSIGNMENT REVISION
                  </span>

                  <strong>
                    {
                      activity.assignmentRevision
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    CREATED
                  </span>

                  <strong>
                    {formatDate(
                      activity.createdAt
                    )}
                  </strong>

                </div>

                <div>

                  <span>
                    LAST UPDATED
                  </span>

                  <strong>
                    {formatDate(
                      activity.updatedAt
                    )}
                  </strong>

                </div>

              </div>

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
                  disabled
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
                  disabled
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
                  className="teacher-activity-details-action danger"
                  disabled
                >
                  <strong>
                    Archive Activity
                  </strong>

                  <span>
                    Remove this activity
                    from the active
                    library.
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