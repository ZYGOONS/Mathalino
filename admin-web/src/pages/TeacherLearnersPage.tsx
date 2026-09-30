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

import "./TeacherLearnersPage.css";

interface LearnerRow {
  id: string;
  name: string;
  status: string;
  registered: string;
}

function getDisplayName(
  data: DocumentData
): string {
  if (
    typeof data.fullName === "string" &&
    data.fullName.trim()
  ) {
    return data.fullName;
  }

  if (
    typeof data.displayName === "string" &&
    data.displayName.trim()
  ) {
    return data.displayName;
  }

  const name = [
    data.firstName,
    data.middleInitial,
    data.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return name || "Unnamed Learner";
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
  status: string
): string {
  if (!status) {
    return "—";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1).toLowerCase()
  );
}

function TeacherLearnersPage() {
  const navigate = useNavigate();

  const [learners, setLearners] =
    useState<LearnerRow[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadLearners = async (
      user: User
    ) => {
      try {
        setLoading(true);
        setError("");

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

        const snapshot =
          await getDocs(
            learnersQuery
          );

        if (!active) {
          return;
        }

        const learnerList:
          LearnerRow[] =
          snapshot.docs.map(
            (document) => {
              const data =
                document.data();

              return {
                id:
                  document.id,

                name:
                  getDisplayName(
                    data
                  ),

                status:
                  data.status ??
                  data.accountStatus ??
                  "",

                registered:
                  formatTimestamp(
                    data.createdAt
                  ),
              };
            }
          );

        setLearners(
          learnerList
        );
      } catch (loadError) {
        console.error(
          "Unable to load learners:",
          loadError
        );

        if (active) {
          setError(
            "Unable to load your learners."
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

          void loadLearners(
            user
          );
        }
      );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  const filteredLearners =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return learners;
      }

      return learners.filter(
        (learner) =>
          learner.name
            .toLowerCase()
            .includes(keyword)
      );
    }, [learners, search]);

  return (
    <TeacherLayout>

      <div className="teacher-learners-heading">

        <div>
          <span className="teacher-learners-eyebrow">
            LEARNER MANAGEMENT
          </span>

          <h2>
            My Learners
          </h2>

          <p>
            View learners assigned to
            your teacher account.
          </p>
        </div>

        <div className="teacher-learners-total">

          <span>
            TOTAL LEARNERS
          </span>

          <strong>
            {loading
              ? "—"
              : learners.length}
          </strong>

        </div>

      </div>

      <section className="teacher-learners-card">

        <div className="teacher-learners-toolbar">

          <div>
            <h3>
              Learner Accounts
            </h3>

            <p>
              Only learners assigned
              to you are displayed.
            </p>
          </div>

          <input
            type="search"
            value={search}
            placeholder="Search learner..."
            aria-label="Search learners"
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

        </div>

        {loading && (
          <div className="teacher-learners-message">
            Loading learners...
          </div>
        )}

        {!loading &&
          error && (
            <div
              className="teacher-learners-message teacher-learners-error"
              role="alert"
            >
              {error}
            </div>
          )}

        {!loading &&
          !error &&
          filteredLearners.length ===
            0 && (
            <div className="teacher-learners-message">
              {search
                ? "No learners match your search."
                : "No learners are currently assigned to this teacher account."}
            </div>
          )}

        {!loading &&
          !error &&
          filteredLearners.length >
            0 && (
            <div className="teacher-learners-table-wrapper">

              <table className="teacher-learners-table">

                <thead>
                  <tr>
                    <th>
                      Learner
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Registered
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {filteredLearners.map(
                    (learner) => (
                      <tr
                        key={
                          learner.id
                        }
                      >

                        <td className="teacher-learner-name">
                          {
                            learner.name
                          }
                        </td>

                        <td>
                          {learner.status ? (
                            <span
                              className={
                                learner.status
                                  .toLowerCase() ===
                                "active"
                                  ? "teacher-learner-status active"
                                  : "teacher-learner-status"
                              }
                            >
                              {formatStatus(
                                learner.status
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          {
                            learner.registered
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

export default TeacherLearnersPage;