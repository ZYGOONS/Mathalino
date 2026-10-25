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
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherLearnersPage.css";

interface Learner {
  id: string;

  teacherId: string;

  firstName: string;
  lastName: string;

  fullName: string;

  status: string;

  createdAt: unknown;
}

function formatDate(
  value: unknown
): string {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return "—";
  }

  if (
    "toDate" in value &&
    typeof value.toDate ===
      "function"
  ) {
    const date =
      value.toDate();

    return date.toLocaleDateString(
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

  return "—";
}

function getLearnerName(
  learner: Learner
): string {
  if (
    learner.fullName.trim()
  ) {
    return learner.fullName.trim();
  }

  const name = [
    learner.firstName,
    learner.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    name ||
    "Unnamed Learner"
  );
}

function TeacherLearnersPage() {
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
    search,
    setSearch,
  ] =
    useState("");

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
   * LOAD TEACHER LEARNERS
   * =========================
   */

  useEffect(() => {
    let unsubscribeLearners:
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

          setError(
            ""
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
                const learnerList =
                  snapshot.docs.map(
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

                        fullName:
                          data.fullName ??
                          "",

                        status:
                          data.status ??
                          "active",

                        createdAt:
                          data.createdAt ??
                          null,
                      };
                    }
                  );

                learnerList.sort(
                  (
                    first,
                    second
                  ) =>
                    getLearnerName(
                      first
                    ).localeCompare(
                      getLearnerName(
                        second
                      )
                    )
                );

                setLearners(
                  learnerList
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
                  "Could not load your learners."
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

      unsubscribeLearners?.();
    };
  }, [
    navigate,
  ]);

  /*
   * =========================
   * SEARCH
   * =========================
   */

  const filteredLearners =
    useMemo(
      () => {
        const keyword =
          search
            .trim()
            .toLowerCase();

        if (!keyword) {
          return learners;
        }

        return learners.filter(
          (
            learner
          ) =>
            getLearnerName(
              learner
            )
              .toLowerCase()
              .includes(
                keyword
              )
        );
      },
      [
        learners,
        search,
      ]
    );

  /*
   * =========================
   * UI
   * =========================
   */

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
            View and manage learners
            assigned to your teacher
            account.
          </p>

        </div>

        <div className="teacher-learners-heading-actions">

          <div className="teacher-learners-total">

            <span>
              TOTAL LEARNERS
            </span>

            <strong>
              {
                learners.length
              }
            </strong>

          </div>

          <button
            type="button"
            className="teacher-learners-create"
            onClick={() =>
              navigate(
                "/teacher/learners/create"
              )
            }
          >
            + Create Learner
          </button>

        </div>

      </div>

      {error && (
        <div
          className="teacher-learners-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="teacher-learners-card">

        <div className="teacher-learners-toolbar">

          <div>

            <h3>
              Learner Accounts
            </h3>

            <p>
              Only learners assigned to
              you are displayed.
            </p>

          </div>

          <input
            type="search"
            placeholder="Search learner..."
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

        {loading && (
          <div className="teacher-learners-message">
            Loading learners...
          </div>
        )}

        {!loading &&
          filteredLearners.length ===
            0 && (
            <div className="teacher-learners-message">

              {search
                ? "No learners match your search."
                : "No learners found. Create your first learner to get started."}

            </div>
          )}

        {!loading &&
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

                    <th>
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredLearners.map(
                    (
                      learner
                    ) => (
                      <tr
                        key={
                          learner.id
                        }
                      >

                        <td className="teacher-learner-name">
                          {getLearnerName(
                            learner
                          )}
                        </td>

                        <td>

                          <span
                            className={
                              learner.status ===
                              "active"
                                ? "teacher-learner-list-status active"
                                : "teacher-learner-list-status inactive"
                            }
                          >
                            {learner.status ===
                            "active"
                              ? "Active"
                              : "Inactive"}
                          </span>

                        </td>

                        <td>
                          {formatDate(
                            learner.createdAt
                          )}
                        </td>

                        <td>

                          <button
                            type="button"
                            className="teacher-learner-view-button"
                            onClick={() =>
                              navigate(
                                `/teacher/learners/${learner.id}`
                              )
                            }
                          >
                            View Details
                          </button>

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