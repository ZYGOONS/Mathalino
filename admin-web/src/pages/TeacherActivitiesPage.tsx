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

import {
  setActivityTrashed,
} from "../services/activityTrash";

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
    showingTrash,
    setShowingTrash,
  ] =
    useState(false);

  const [
    busyActivityId,
    setBusyActivityId,
  ] =
    useState<
      string | null
    >(
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
   * LOAD ACTIVITIES
   * =========================
   */

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
                        activity.libraryVisible
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

  /*
   * =========================
   * VISIBLE / FILTERED
   * =========================
   */

  const trashCount =
    useMemo(
      () =>
        activities.filter(
          (
            activity
          ) =>
            activity.trashed
        ).length,
      [
        activities,
      ]
    );

  const visibleActivities =
    useMemo(
      () =>
        activities.filter(
          (
            activity
          ) =>
            activity.trashed ===
            showingTrash
        ),
      [
        activities,
        showingTrash,
      ]
    );

  const filteredActivities =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toLowerCase();

        return visibleActivities.filter(
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
        visibleActivities,
        search,
        topicFilter,
      ]
    );

  /*
   * =========================
   * TRASH / RESTORE
   * =========================
   */

  const handleTrashChange =
    async (
      activity:
        Activity,
      trash: boolean
    ) => {
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
        setBusyActivityId(
          activity.id
        );

        setError(
          ""
        );

        await setActivityTrashed(
          activity.id,
          trash
        );
      } catch (
        trashError
      ) {
        console.error(
          "Could not update activity trash state:",
          trashError
        );

        setError(
          trashError instanceof
          Error
            ? trashError.message
            : "Could not update activity."
        );
      } finally {
        setBusyActivityId(
          null
        );
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-activities-heading">

        <div>

          <span className="teacher-activities-eyebrow">
            ACTIVITY MANAGEMENT
          </span>

          <h2>
            {showingTrash
              ? "Activity Trash"
              : "Activities"}
          </h2>

          <p>
            {showingTrash
              ? "Restore activities that were removed from the active library."
              : "Create and manage mathematics activities for your learners."}
          </p>

        </div>

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "10px",

            flexWrap:
              "wrap",
          }}
        >

          <button
            type="button"
            className="teacher-activities-create"
            style={
              showingTrash
                ? {
                    background:
                      "#ffffff",

                    color:
                      "#007d72",
                  }
                : undefined
            }
            onClick={() => {
              setShowingTrash(
                !showingTrash
              );

              setSearch(
                ""
              );

              setTopicFilter(
                "all"
              );

              setError(
                ""
              );
            }}
          >
            {showingTrash
              ? "← Back to Library"
              : `Trash (${trashCount})`}
          </button>

          {!showingTrash && (
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
          )}

        </div>

      </div>

      {error && (
        <div
          className="teacher-activities-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* FILTERS */}

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

      {/* SUMMARY */}

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

      {/* LOADING */}

      {loading && (
        <div className="teacher-activities-loading">
          Loading activities...
        </div>
      )}

      {/* EMPTY */}

      {!loading &&
        filteredActivities.length ===
          0 && (
          <section className="teacher-activities-empty">

            <h3>
              {showingTrash
                ? visibleActivities.length ===
                  0
                  ? "Trash is empty"
                  : "No matching activities"
                : visibleActivities.length ===
                    0
                  ? "No activities yet"
                  : "No matching activities"}
            </h3>

            <p>
              {showingTrash
                ? visibleActivities.length ===
                  0
                  ? "Activities that you move to Trash will appear here and can be restored later."
                  : "Try changing your search or topic filter."
                : visibleActivities.length ===
                    0
                  ? "Create your first Mathalino activity to begin assigning learning tasks."
                  : "Try changing your search or topic filter."}
            </p>

            {!showingTrash &&
              visibleActivities.length ===
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

      {/* LIST */}

      {!loading &&
        filteredActivities.length >
          0 && (
          <div className="teacher-activities-list">

            {filteredActivities.map(
              (
                activity
              ) => {
                const busy =
                  busyActivityId ===
                  activity.id;

                return (
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
                        className={`teacher-activity-status ${
                          activity.trashed
                            ? "archived"
                            : activity.status
                        }`}
                      >
                        {activity.trashed
                          ? "In Trash"
                          : activity.status ===
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

                      <div
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap:
                            "7px",

                          flexWrap:
                            "wrap",
                        }}
                      >

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            navigate(
                              `/teacher/activities/${activity.id}`
                            )
                          }
                        >
                          Manage
                        </button>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          style={{
                            color:
                              showingTrash
                                ? "#007d72"
                                : "#a34840",
                          }}
                          onClick={() => {
                            void handleTrashChange(
                              activity,
                              !showingTrash
                            );
                          }}
                        >
                          {busy
                            ? "Updating..."
                            : showingTrash
                              ? "Restore"
                              : "Trash"}
                        </button>

                      </div>

                    </div>

                  </article>
                );
              }
            )}

          </div>
        )}

    </TeacherLayout>
  );
}

export default TeacherActivitiesPage;