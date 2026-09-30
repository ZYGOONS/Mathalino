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
  type User,
} from "firebase/auth";

import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherActivitiesPage.css";

interface ActivityRow {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

function getActivityTitle(
  data: DocumentData
): string {
  if (
    typeof data.title === "string" &&
    data.title.trim()
  ) {
    return data.title;
  }

  if (
    typeof data.name === "string" &&
    data.name.trim()
  ) {
    return data.name;
  }

  if (
    typeof data.activityName === "string" &&
    data.activityName.trim()
  ) {
    return data.activityName;
  }

  return "Untitled Activity";
}

function getDescription(
  data: DocumentData
): string {
  if (
    typeof data.description === "string" &&
    data.description.trim()
  ) {
    return data.description;
  }

  if (
    typeof data.instructions === "string" &&
    data.instructions.trim()
  ) {
    return data.instructions;
  }

  return "—";
}

function formatTimestamp(
  value: unknown
): string {
  if (!value) {
    return "—";
  }

  const timestamp =
    value as Timestamp;

  if (
    typeof timestamp?.toDate ===
    "function"
  ) {
    return timestamp
      .toDate()
      .toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );
  }

  return "—";
}

function formatStatus(
  value: string
): string {
  if (!value) {
    return "—";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1).toLowerCase()
  );
}

function TeacherActivitiesPage() {
  const navigate = useNavigate();

  const [activities, setActivities] =
    useState<ActivityRow[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadActivities = async (
      user: User
    ) => {
      try {
        setLoading(true);
        setError("");

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

        const snapshot =
          await getDocs(
            activitiesQuery
          );

        if (!active) {
          return;
        }

        const activityList:
          ActivityRow[] =
          snapshot.docs.map(
            (document) => {
              const data =
                document.data();

              return {
                id:
                  document.id,

                title:
                  getActivityTitle(
                    data
                  ),

                description:
                  getDescription(
                    data
                  ),

                status:
                  data.status ??
                  "",

                createdAt:
                  formatTimestamp(
                    data.createdAt
                  ),
              };
            }
          );

        setActivities(
          activityList
        );
      } catch (loadError) {
        console.error(
          "Unable to load activities:",
          loadError
        );

        if (active) {
          setError(
            "Unable to load your activities."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            navigate("/");
            return;
          }

          void loadActivities(
            user
          );
        }
      );

    return () => {
      active = false;

      unsubscribe();
    };
  }, [navigate]);

  const filteredActivities =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return activities;
      }

      return activities.filter(
        (activity) =>
          activity.title
            .toLowerCase()
            .includes(keyword) ||
          activity.description
            .toLowerCase()
            .includes(keyword)
      );
    }, [
      activities,
      search,
    ]);

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
            View learning activities created
            under your teacher account.
          </p>

        </div>

        <div className="teacher-activities-total">

          <span>
            TOTAL ACTIVITIES
          </span>

          <strong>
            {loading
              ? "—"
              : activities.length}
          </strong>

        </div>

      </div>

      <section className="teacher-activities-card">

        <div className="teacher-activities-toolbar">

          <div>

            <h3>
              Learning Activities
            </h3>

            <p>
              Only activities belonging to
              your account are displayed.
            </p>

          </div>

          <input
            type="search"
            value={search}
            placeholder="Search activity..."
            aria-label="Search activities"
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

        </div>

        {loading && (
          <div className="teacher-activities-message">
            Loading activities...
          </div>
        )}

        {!loading &&
          error && (
            <div
              className="teacher-activities-message teacher-activities-error"
              role="alert"
            >
              {error}
            </div>
          )}

        {!loading &&
          !error &&
          filteredActivities.length ===
            0 && (
            <div className="teacher-activities-message">
              {search
                ? "No activities match your search."
                : "No activities have been created for this teacher account yet."}
            </div>
          )}

        {!loading &&
          !error &&
          filteredActivities.length >
            0 && (
            <div className="teacher-activities-table-wrapper">

              <table className="teacher-activities-table">

                <thead>
                  <tr>
                    <th>
                      Activity
                    </th>

                    <th>
                      Description
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Created
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {filteredActivities.map(
                    (activity) => (
                      <tr
                        key={
                          activity.id
                        }
                      >

                        <td className="teacher-activity-title">
                          {
                            activity.title
                          }
                        </td>

                        <td className="teacher-activity-description">
                          {
                            activity.description
                          }
                        </td>

                        <td>
                          {activity.status ? (
                            <span className="teacher-activity-status">
                              {formatStatus(
                                activity.status
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          {
                            activity.createdAt
                          }
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

      </section>

    </TeacherLayout>
  );
}

export default TeacherActivitiesPage;