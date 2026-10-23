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
  onSnapshot,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherActivitiesPage.css";

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

  status: string;

  libraryVisible: boolean;

  trashed: boolean;

  createdAt:
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
      return difficulty ||
        "—";
  }
}

function formatDate(
  timestamp:
    Timestamp | null
): string {
  if (!timestamp) {
    return "Date unavailable";
  }

  return timestamp
    .toDate()
    .toLocaleDateString(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric",

        year:
          "numeric",
      }
    );
}

function TeacherActivitiesPage() {
  const navigate =
    useNavigate();

  const [
    activities,
    setActivities,
  ] =
    useState<Activity[]>(
      []
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    topicFilter,
    setTopicFilter,
  ] =
    useState("all");

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

  useEffect(() => {
    let unsubscribeActivities:
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

                          status:
                            data.status ??
                            "active",

                          libraryVisible:
                            data.libraryVisible !==
                            false,

                          trashed:
                            data.trashed ===
                            true,

                          createdAt:
                            data.createdAt ??
                            null,
                        };
                      }
                    )
                    .filter(
                      (
                        activity
                      ) =>
                        activity.libraryVisible &&
                        !activity.trashed
                    )
                    .sort(
                      (
                        first,
                        second
                      ) =>
                        (
                          second.createdAt
                            ?.seconds ??
                          0
                        ) -
                        (
                          first.createdAt
                            ?.seconds ??
                          0
                        )
                    );

                setActivities(
                  list
                );

                setLoading(
                  false
                );

                setError(
                  ""
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

                setLoading(
                  false
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      unsubscribeActivities?.();
    };
  }, [
    navigate,
  ]);

  const filteredActivities =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toLowerCase();

        return activities.filter(
          (
            activity
          ) => {
            const matchesSearch =
              !normalizedSearch ||
              activity.title
                .toLowerCase()
                .includes(
                  normalizedSearch
                ) ||
              activity.topic
                .toLowerCase()
                .includes(
                  normalizedSearch
                ) ||
              activity.grade
                .toLowerCase()
                .includes(
                  normalizedSearch
                );

            const matchesTopic =
              topicFilter ===
                "all" ||
              activity.topic ===
                topicFilter;

            return (
              matchesSearch &&
              matchesTopic
            );
          }
        );
      },
      [
        activities,
        search,
        topicFilter,
      ]
    );

  return (
    <TeacherLayout>

      <div className="teacher-activities-heading">

        <div>

          <span className="teacher-activities-eyebrow">
            ACTIVITY MANAGEMENT
          </span>

          <h2>
            Activities
          </h2>

          <p>
            Create and manage mathematics
            activities for your learners.
          </p>

        </div>

        <button
          type="button"
          className="teacher-activities-create"
          onClick={() =>
            navigate(
              "/teacher/activities/create"
            )
          }
        >
          + Create Activity
        </button>

      </div>

      {error && (
        <div
          className="teacher-activities-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="teacher-activities-toolbar">

        <div className="teacher-activities-search">

          <label htmlFor="teacher-activity-search">
            SEARCH ACTIVITIES
          </label>

          <input
            id="teacher-activity-search"
            type="search"
            placeholder="Search by title, topic, or grade..."
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
          />

        </div>

        <div className="teacher-activities-filter">

          <label htmlFor="teacher-activity-topic">
            TOPIC
          </label>

          <select
            id="teacher-activity-topic"
            value={
              topicFilter
            }
            onChange={(
              event
            ) =>
              setTopicFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Topics
            </option>

            <option value="Number Sense">
              Number Sense
            </option>

            <option value="Addition">
              Addition
            </option>

            <option value="Subtraction">
              Subtraction
            </option>
          </select>

        </div>

      </section>

      <div className="teacher-activities-summary">

        <strong>
          {
            filteredActivities.length
          }
        </strong>

        <span>
          {filteredActivities.length ===
          1
            ? "activity"
            : "activities"}
        </span>

      </div>

      {loading && (
        <div className="teacher-activities-loading">
          Loading activities...
        </div>
      )}

      {!loading &&
        filteredActivities.length ===
          0 && (
          <section className="teacher-activities-empty">

            <h3>
              {activities.length ===
              0
                ? "No activities yet"
                : "No matching activities"}
            </h3>

            <p>
              {activities.length ===
              0
                ? "Create your first Mathalino activity to begin assigning learning tasks."
                : "Try changing your search or topic filter."}
            </p>

            {activities.length ===
              0 && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/teacher/activities/create"
                  )
                }
              >
                Create Activity
              </button>
            )}

          </section>
        )}

      {!loading &&
        filteredActivities.length >
          0 && (
          <div className="teacher-activities-list">

            {filteredActivities.map(
              (
                activity
              ) => (
                <article
                  key={
                    activity.id
                  }
                  className="teacher-activity-card"
                >

                  <div className="teacher-activity-card-top">

                    <div>

                      <span className="teacher-activity-topic">
                        {
                          activity.topic
                        }
                      </span>

                      <h3>
                        {activity.title ||
                          "Untitled Activity"}
                      </h3>

                    </div>

                    <span
                      className={`teacher-activity-status ${activity.status}`}
                    >
                      {activity.status ===
                      "active"
                        ? "Active"
                        : activity.status}
                    </span>

                  </div>

                  {activity.description && (
                    <p className="teacher-activity-description">
                      {
                        activity.description
                      }
                    </p>
                  )}

                  <div className="teacher-activity-meta">

                    <div>

                      <span>
                        GRADE
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
                        RANGE
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

                  </div>

                  <div className="teacher-activity-card-footer">

                    <span>
                      Created{" "}
                      {formatDate(
                        activity.createdAt
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/teacher/activities/${activity.id}`
                        )
                      }
                    >
                      Manage
                    </button>

                  </div>

                </article>
              )
            )}

          </div>
        )}

    </TeacherLayout>
  );
}

export default TeacherActivitiesPage;