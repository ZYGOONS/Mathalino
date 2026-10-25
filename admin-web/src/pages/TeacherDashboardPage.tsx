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
  getDoc,
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

import "./TeacherDashboardPage.css";

/*
 * =========================
 * ICONS
 * =========================
 */

function CreateLearnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle
        cx="9"
        cy="7"
        r="4"
      />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}

function CreateActivityIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="2"
      />

      <path d="M9 3v3h6V3" />

      <path d="M12 10v6" />

      <path d="M9 13h6" />
    </svg>
  );
}

function LearnersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />

      <circle
        cx="9"
        cy="7"
        r="4"
      />

      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />

      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SmartBoardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="13"
        rx="2"
      />

      <path d="M8 21h8" />

      <path d="M12 17v4" />

      <path d="m9 10 2 2 4-4" />
    </svg>
  );
}

function GuardianIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />

      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LiveSessionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  );
}

/*
 * =========================
 * TYPES
 * =========================
 */

interface TeacherProfile {
  name: string;
  school: string;
}

interface Learner {
  id: string;
  status: string;
}

interface Activity {
  id: string;

  status: string;

  libraryVisible: boolean;
  trashed: boolean;
}

interface GuardianRequest {
  id: string;
  status: string;
}

interface SmartBoard {
  id: string;

  name: string;
  room: string;

  status: string;

  enabled: boolean;
  linked: boolean;

  currentSessionId:
    | string
    | null;
}

interface LiveSession {
  id: string;

  learnerId: string;
  learnerName: string;

  assignmentId:
    | string
    | null;

  activityTitle: string;

  topic: string;

  status: string;

  currentQuestion: number;
  totalQuestions: number;

  correctAnswers: number;

  score:
    | number
    | null;

  accuracyPercent:
    | number
    | null;

  endedAt:
    | Timestamp
    | null;
}

/*
 * =========================
 * HELPERS
 * =========================
 */

function getTeacherName(
  data:
    Record<
      string,
      unknown
    >
): string {
  if (
    typeof data.fullName ===
      "string" &&
    data.fullName.trim()
  ) {
    return data.fullName.trim();
  }

  if (
    typeof data.displayName ===
      "string" &&
    data.displayName.trim()
  ) {
    return data.displayName.trim();
  }

  const firstName =
    typeof data.firstName ===
    "string"
      ? data.firstName
      : "";

  const middleInitial =
    typeof data.middleInitial ===
    "string"
      ? data.middleInitial
      : "";

  const lastName =
    typeof data.lastName ===
    "string"
      ? data.lastName
      : "";

  const name = [
    firstName,
    middleInitial,
    lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    name ||
    "Teacher"
  );
}

function formatDateTime(
  timestamp:
    Timestamp | null
): string {
  if (!timestamp) {
    return "Date unavailable";
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

function isBoardBusy(
  board: SmartBoard
): boolean {
  return (
    board.status ===
      "in_session" ||
    Boolean(
      board.currentSessionId
    )
  );
}

/*
 * =========================
 * PAGE
 * =========================
 */

function TeacherDashboardPage() {
  const navigate =
    useNavigate();

  const [
    teacher,
    setTeacher,
  ] =
    useState<TeacherProfile>({
      name:
        "Teacher",

      school:
        "",
    });

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
    guardianRequests,
    setGuardianRequests,
  ] =
    useState<
      GuardianRequest[]
    >([]);

  const [
    boards,
    setBoards,
  ] =
    useState<
      SmartBoard[]
    >([]);

  const [
    sessions,
    setSessions,
  ] =
    useState<
      LiveSession[]
    >([]);

  const [
    profileLoaded,
    setProfileLoaded,
  ] =
    useState(false);

  const [
    learnersLoaded,
    setLearnersLoaded,
  ] =
    useState(false);

  const [
    activitiesLoaded,
    setActivitiesLoaded,
  ] =
    useState(false);

  const [
    requestsLoaded,
    setRequestsLoaded,
  ] =
    useState(false);

  const [
    boardsLoaded,
    setBoardsLoaded,
  ] =
    useState(false);

  const [
    sessionsLoaded,
    setSessionsLoaded,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * =========================
   * LOAD
   * =========================
   */

  useEffect(() => {
    let unsubscribeLearners:
      | (() => void)
      | undefined;

    let unsubscribeActivities:
      | (() => void)
      | undefined;

    let unsubscribeRequests:
      | (() => void)
      | undefined;

    let unsubscribeBoards:
      | (() => void)
      | undefined;

    let unsubscribeSessions:
      | (() => void)
      | undefined;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        async (
          user
        ) => {
          if (!user) {
            navigate("/");

            return;
          }

          setError("");

          setProfileLoaded(false);
          setLearnersLoaded(false);
          setActivitiesLoaded(false);
          setRequestsLoaded(false);
          setBoardsLoaded(false);
          setSessionsLoaded(false);

          /*
           * TEACHER
           */

          try {
            const teacherSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              teacherSnapshot.exists()
            ) {
              const data =
                teacherSnapshot.data();

              setTeacher({
                name:
                  getTeacherName(
                    data
                  ),

                school:
                  typeof data.school ===
                    "string"
                    ? data.school
                    : typeof data.schoolName ===
                        "string"
                      ? data.schoolName
                      : "",
              });
            } else {
              setTeacher({
                name:
                  user.displayName ||
                  "Teacher",

                school:
                  "",
              });
            }
          } catch (
            profileError
          ) {
            console.error(
              profileError
            );

            setTeacher({
              name:
                user.displayName ||
                "Teacher",

              school:
                "",
            });

            setError(
              "Some dashboard information could not be loaded."
            );
          } finally {
            setProfileLoaded(
              true
            );
          }

          /*
           * LEARNERS
           */

          unsubscribeLearners =
            onSnapshot(
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
              ),
              (
                snapshot
              ) => {
                setLearners(
                  snapshot.docs.map(
                    (
                      document
                    ) => ({
                      id:
                        document.id,

                      status:
                        document.data()
                          .status ??
                        "active",
                    })
                  )
                );

                setLearnersLoaded(
                  true
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  snapshotError
                );

                setError(
                  "Some dashboard information could not be loaded."
                );

                setLearnersLoaded(
                  true
                );
              }
            );

          /*
           * ACTIVITIES
           */

          unsubscribeActivities =
            onSnapshot(
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
              ),
              (
                snapshot
              ) => {
                setActivities(
                  snapshot.docs.map(
                    (
                      document
                    ) => {
                      const data =
                        document.data();

                      return {
                        id:
                          document.id,

                        status:
                          data.status ??
                          "active",

                        libraryVisible:
                          data.libraryVisible !==
                          false,

                        trashed:
                          data.trashed ===
                          true,
                      };
                    }
                  )
                );

                setActivitiesLoaded(
                  true
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  snapshotError
                );

                setError(
                  "Some dashboard information could not be loaded."
                );

                setActivitiesLoaded(
                  true
                );
              }
            );

          /*
           * GUARDIAN REQUESTS
           */

          unsubscribeRequests =
            onSnapshot(
              query(
                collection(
                  db,
                  "guardianRequests"
                ),

                where(
                  "teacherId",
                  "==",
                  user.uid
                )
              ),
              (
                snapshot
              ) => {
                setGuardianRequests(
                  snapshot.docs.map(
                    (
                      document
                    ) => ({
                      id:
                        document.id,

                      status:
                        document.data()
                          .status ??
                        "pending",
                    })
                  )
                );

                setRequestsLoaded(
                  true
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  snapshotError
                );

                setError(
                  "Some dashboard information could not be loaded."
                );

                setRequestsLoaded(
                  true
                );
              }
            );

          /*
           * BOARDS
           */

          unsubscribeBoards =
            onSnapshot(
              query(
                collection(
                  db,
                  "boards"
                ),

                where(
                  "teacherId",
                  "==",
                  user.uid
                )
              ),
              (
                snapshot
              ) => {
                setBoards(
                  snapshot.docs.map(
                    (
                      document
                    ) => {
                      const data =
                        document.data();

                      return {
                        id:
                          document.id,

                        name:
                          data.name ??
                          "",

                        room:
                          data.room ??
                          "",

                        status:
                          data.status ??
                          "offline",

                        enabled:
                          data.enabled ??
                          true,

                        linked:
                          data.linked ??
                          true,

                        currentSessionId:
                          data.currentSessionId ??
                          null,
                      };
                    }
                  )
                );

                setBoardsLoaded(
                  true
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  snapshotError
                );

                setError(
                  "Some dashboard information could not be loaded."
                );

                setBoardsLoaded(
                  true
                );
              }
            );

          /*
           * SESSIONS
           */

          unsubscribeSessions =
            onSnapshot(
              query(
                collection(
                  db,
                  "liveSessions"
                ),

                where(
                  "teacherId",
                  "==",
                  user.uid
                )
              ),
              (
                snapshot
              ) => {
                setSessions(
                  snapshot.docs.map(
                    (
                      document
                    ) => {
                      const data =
                        document.data();

                      return {
                        id:
                          document.id,

                        learnerId:
                          data.learnerId ??
                          "",

                        learnerName:
                          data.learnerName ??
                          "",

                        assignmentId:
                          data.assignmentId ??
                          null,

                        activityTitle:
                          data.activityTitle ??
                          "",

                        topic:
                          data.topic ??
                          "",

                        status:
                          data.status ??
                          "",

                        currentQuestion:
                          Number(
                            data.currentQuestion ??
                              0
                          ),

                        totalQuestions:
                          Number(
                            data.totalQuestions ??
                              0
                          ),

                        correctAnswers:
                          Number(
                            data.correctAnswers ??
                              0
                          ),

                        score:
                          data.score ===
                            null ||
                          data.score ===
                            undefined
                            ? null
                            : Number(
                                data.score
                              ),

                        accuracyPercent:
                          data.accuracyPercent ===
                            null ||
                          data.accuracyPercent ===
                            undefined
                            ? null
                            : Number(
                                data.accuracyPercent
                              ),

                        endedAt:
                          data.endedAt ??
                          null,
                      };
                    }
                  )
                );

                setSessionsLoaded(
                  true
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  snapshotError
                );

                setError(
                  "Some dashboard information could not be loaded."
                );

                setSessionsLoaded(
                  true
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      unsubscribeLearners?.();
      unsubscribeActivities?.();
      unsubscribeRequests?.();
      unsubscribeBoards?.();
      unsubscribeSessions?.();
    };
  }, [
    navigate,
  ]);

  /*
   * =========================
   * VALUES
   * =========================
   */

  const activeLearners =
    useMemo(
      () =>
        learners.filter(
          (
            learner
          ) =>
            learner.status ===
            "active"
        ).length,
      [
        learners,
      ]
    );

  const activeActivities =
    useMemo(
      () =>
        activities.filter(
          (
            activity
          ) =>
            activity.libraryVisible &&
            !activity.trashed &&
            activity.status ===
              "active"
        ).length,
      [
        activities,
      ]
    );

  const pendingGuardianRequests =
    useMemo(
      () =>
        guardianRequests.filter(
          (
            request
          ) =>
            request.status ===
            "pending"
        ).length,
      [
        guardianRequests,
      ]
    );

  const linkedBoards =
    useMemo(
      () =>
        boards.filter(
          (
            board
          ) =>
            board.linked
        ),
      [
        boards,
      ]
    );

  const availableBoards =
    useMemo(
      () =>
        linkedBoards.filter(
          (
            board
          ) =>
            board.enabled &&
            board.status ===
              "available" &&
            !board.currentSessionId
        ).length,
      [
        linkedBoards,
      ]
    );

  const busyBoards =
    useMemo(
      () =>
        linkedBoards.filter(
          isBoardBusy
        ).length,
      [
        linkedBoards,
      ]
    );

  const inactiveBoards =
    useMemo(
      () =>
        linkedBoards.filter(
          (
            board
          ) =>
            !board.enabled ||
            board.status ===
              "inactive"
        ).length,
      [
        linkedBoards,
      ]
    );

  const activeSessions =
    useMemo(
      () =>
        sessions.filter(
          (
            session
          ) =>
            session.status ===
            "active"
        ),
      [
        sessions,
      ]
    );

  const recentCompletedSessions =
    useMemo(
      () =>
        sessions
          .filter(
            (
              session
            ) =>
              session.status ===
              "completed"
          )
          .sort(
            (
              first,
              second
            ) =>
              (
                second.endedAt
                  ?.seconds ??
                0
              ) -
              (
                first.endedAt
                  ?.seconds ??
                0
              )
          )
          .slice(
            0,
            5
          ),
      [
        sessions,
      ]
    );

  const loading =
    !profileLoaded ||
    !learnersLoaded ||
    !activitiesLoaded ||
    !requestsLoaded ||
    !boardsLoaded ||
    !sessionsLoaded;

  const initial =
    teacher.name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "T";

  const openSessionResult = (
    session:
      LiveSession
  ) => {
    if (
      !session.learnerId
    ) {
      return;
    }

    if (
      session.assignmentId
    ) {
      navigate(
        `/teacher/learners/${session.learnerId}/results?assignmentId=${encodeURIComponent(
          session.assignmentId
        )}`
      );

      return;
    }

    navigate(
      `/teacher/learners/${session.learnerId}/results`
    );
  };

  return (
    <TeacherLayout>

      {/* HEADER */}

      <header className="teacher-dashboard-header">

        <div>

          <span className="teacher-dashboard-eyebrow">
            TEACHER PORTAL
          </span>

          <h2>
            Welcome back,{" "}
            {teacher.name}.
          </h2>

          <p>
            Monitor your Mathalino
            classroom and quickly access
            the tools you use most.
          </p>

        </div>

        <button
          type="button"
          className="teacher-dashboard-profile"
          onClick={() =>
            navigate(
              "/teacher/account"
            )
          }
        >

          <div className="teacher-dashboard-avatar">
            {initial}
          </div>

          <div className="teacher-dashboard-profile-info">

            <strong>
              {teacher.name}
            </strong>

            <span>
              {teacher.school ||
                "Mathalino Teacher"}
            </span>

          </div>

        </button>

      </header>

      {error && (
        <div className="teacher-dashboard-error">
          {error}
        </div>
      )}

      {/* SUMMARY */}

      <section className="teacher-dashboard-summary">

        <button
          type="button"
          className="teacher-dashboard-summary-card"
          onClick={() =>
            navigate(
              "/teacher/learners"
            )
          }
        >
          <span>
            MY LEARNERS
          </span>

          <strong>
            {loading
              ? "—"
              : learners.length}
          </strong>

          <p>
            {loading
              ? "Loading..."
              : `${activeLearners} active`}
          </p>
        </button>

        <button
          type="button"
          className="teacher-dashboard-summary-card"
          onClick={() =>
            navigate(
              "/teacher/activities"
            )
          }
        >
          <span>
            ACTIVE ACTIVITIES
          </span>

          <strong>
            {loading
              ? "—"
              : activeActivities}
          </strong>

          <p>
            Available in library
          </p>
        </button>

        <button
          type="button"
          className="teacher-dashboard-summary-card"
          onClick={() =>
            navigate(
              "/teacher/boards"
            )
          }
        >
          <span>
            SMART BOARDS
          </span>

          <strong>
            {loading
              ? "—"
              : linkedBoards.length}
          </strong>

          <p>
            Linked boards
          </p>
        </button>

        <button
          type="button"
          className={`teacher-dashboard-summary-card ${
            pendingGuardianRequests >
            0
              ? "attention"
              : ""
          }`}
          onClick={() =>
            navigate(
              "/teacher/guardian-requests"
            )
          }
        >
          <span>
            GUARDIAN REQUESTS
          </span>

          <strong>
            {loading
              ? "—"
              : pendingGuardianRequests}
          </strong>

          <p>
            Pending review
          </p>
        </button>

      </section>

      {/* CLASSROOM STATUS */}

      <section className="teacher-dashboard-content-card">

        <div className="teacher-dashboard-section-heading-row">

          <div>

            <span className="teacher-dashboard-eyebrow">
              CLASSROOM STATUS
            </span>

            <h3>
              Smart Board & Sessions
            </h3>

            <p>
              Current board availability
              and active learning sessions.
            </p>

          </div>

          <button
            type="button"
            className="teacher-dashboard-link-button"
            onClick={() =>
              navigate(
                "/teacher/live-sessions"
              )
            }
          >
            View Live Sessions
          </button>

        </div>

        <div className="teacher-dashboard-status-grid">

          <div className="teacher-dashboard-status-card">
            <span>
              AVAILABLE BOARDS
            </span>

            <strong>
              {loading
                ? "—"
                : availableBoards}
            </strong>

            <p>
              Ready for a learner session
            </p>
          </div>

          <div className="teacher-dashboard-status-card">
            <span>
              IN SESSION
            </span>

            <strong>
              {loading
                ? "—"
                : busyBoards}
            </strong>

            <p>
              Boards currently busy
            </p>
          </div>

          <div className="teacher-dashboard-status-card">
            <span>
              DEACTIVATED
            </span>

            <strong>
              {loading
                ? "—"
                : inactiveBoards}
            </strong>

            <p>
              Linked but unavailable
            </p>
          </div>

          <div
            className={`teacher-dashboard-status-card ${
              activeSessions.length >
              0
                ? "live"
                : ""
            }`}
          >
            <span>
              LIVE SESSIONS
            </span>

            <strong>
              {loading
                ? "—"
                : activeSessions.length}
            </strong>

            <p>
              Active learning sessions
            </p>
          </div>

        </div>

        {activeSessions.length >
          0 && (
          <div className="teacher-dashboard-live-list">

            {activeSessions.map(
              (
                session
              ) => {
                const completed =
                  Math.max(
                    0,
                    Math.min(
                      session.totalQuestions,
                      session.currentQuestion -
                        1
                    )
                  );

                const percentage =
                  session.totalQuestions >
                  0
                    ? Math.round(
                        (
                          completed /
                          session.totalQuestions
                        ) *
                          100
                      )
                    : 0;

                return (
                  <button
                    key={
                      session.id
                    }
                    type="button"
                    className="teacher-dashboard-live-session"
                    onClick={() =>
                      navigate(
                        "/teacher/live-sessions"
                      )
                    }
                  >

                    <div className="teacher-dashboard-live-main">

                      <span>
                        LIVE
                      </span>

                      <strong>
                        {session.learnerName ||
                          "Learner"}
                      </strong>

                      <p>
                        {session.activityTitle ||
                          "Learning Activity"}

                        {session.topic
                          ? ` · ${session.topic}`
                          : ""}
                      </p>

                    </div>

                    <div className="teacher-dashboard-live-progress">

                      <div>

                        <span>
                          {completed} /{" "}
                          {
                            session.totalQuestions
                          }{" "}
                          questions
                        </span>

                        <strong>
                          {
                            percentage
                          }
                          %
                        </strong>

                      </div>

                      <div className="teacher-dashboard-progress-track">

                        <div
                          style={{
                            width:
                              `${percentage}%`,
                          }}
                        />

                      </div>

                    </div>

                  </button>
                );
              }
            )}

          </div>
        )}

        {!loading &&
          activeSessions.length ===
            0 && (
            <div className="teacher-dashboard-no-live">

              No learning session is active
              right now. A session starts
              automatically when a learner
              uses their linked RFID card
              on an available Smart
              Analyzer Board.

            </div>
          )}

      </section>

      {/* QUICK ACCESS */}

      <section className="teacher-dashboard-content-card">

        <div className="teacher-dashboard-section-heading">

          <span className="teacher-dashboard-eyebrow">
            QUICK ACCESS
          </span>

          <h3>
            Classroom Management
          </h3>

        </div>

        <div className="teacher-dashboard-actions">

          <button
            type="button"
            className="teacher-dashboard-action-card"
            onClick={() =>
              navigate(
                "/teacher/learners/create"
              )
            }
          >

            <div className="teacher-dashboard-action-icon">
              <CreateLearnerIcon />
            </div>

            <div>
              <h4>
                Create Learner
              </h4>

              <p>
                Add a new learner to your
                Mathalino classroom.
              </p>
            </div>

          </button>

          <button
            type="button"
            className="teacher-dashboard-action-card"
            onClick={() =>
              navigate(
                "/teacher/activities/create"
              )
            }
          >

            <div className="teacher-dashboard-action-icon">
              <CreateActivityIcon />
            </div>

            <div>
              <h4>
                Create Activity
              </h4>

              <p>
                Build a new mathematics
                activity.
              </p>
            </div>

          </button>

          <button
            type="button"
            className="teacher-dashboard-action-card"
            onClick={() =>
              navigate(
                "/teacher/learners"
              )
            }
          >

            <div className="teacher-dashboard-action-icon">
              <LearnersIcon />
            </div>

            <div>
              <h4>
                My Learners
              </h4>

              <p>
                Manage profiles, RFID,
                assignments and progress.
              </p>
            </div>

          </button>

          <button
            type="button"
            className="teacher-dashboard-action-card"
            onClick={() =>
              navigate(
                "/teacher/boards"
              )
            }
          >

            <div className="teacher-dashboard-action-icon">
              <SmartBoardIcon />
            </div>

            <div>
              <h4>
                Smart Boards
              </h4>

              <p>
                Link boards and review
                board availability.
              </p>
            </div>

          </button>

          <button
            type="button"
            className="teacher-dashboard-action-card"
            onClick={() =>
              navigate(
                "/teacher/guardian-requests"
              )
            }
          >

            <div className="teacher-dashboard-action-icon">
              <GuardianIcon />
            </div>

            <div>
              <h4>
                Guardian Requests
              </h4>

              <p>
                Review learner access
                requests from guardians.
              </p>
            </div>

          </button>

          <button
            type="button"
            className="teacher-dashboard-action-card"
            onClick={() =>
              navigate(
                "/teacher/live-sessions"
              )
            }
          >

            <div className="teacher-dashboard-action-icon">
              <LiveSessionIcon />
            </div>

            <div>
              <h4>
                Live Sessions
              </h4>

              <p>
                Monitor current Smart
                Analyzer Board sessions.
              </p>
            </div>

          </button>

        </div>

      </section>

      {/* RECENT RESULTS */}

      <section className="teacher-dashboard-content-card">

        <div className="teacher-dashboard-section-heading-row">

          <div>

            <span className="teacher-dashboard-eyebrow">
              RECENT RESULTS
            </span>

            <h3>
              Completed Sessions
            </h3>

            <p>
              The most recently completed
              learner sessions.
            </p>

          </div>

        </div>

        {loading && (
          <div className="teacher-dashboard-empty">
            Loading recent sessions...
          </div>
        )}

        {!loading &&
          recentCompletedSessions.length ===
            0 && (
            <div className="teacher-dashboard-empty">

              No completed learning
              sessions yet.

            </div>
          )}

        {!loading &&
          recentCompletedSessions.length >
            0 && (
            <div className="teacher-dashboard-results">

              {recentCompletedSessions.map(
                (
                  session
                ) => {
                  const score =
                    session.score ??
                    session.correctAnswers;

                  const accuracy =
                    session.accuracyPercent ??
                    (
                      session.totalQuestions >
                      0
                        ? Math.round(
                            (
                              score /
                              session.totalQuestions
                            ) *
                              100
                          )
                        : null
                    );

                  return (
                    <button
                      key={
                        session.id
                      }
                      type="button"
                      className="teacher-dashboard-result-row"
                      disabled={
                        !session.learnerId
                      }
                      onClick={() =>
                        openSessionResult(
                          session
                        )
                      }
                    >

                      <div className="teacher-dashboard-result-main">

                        <strong>
                          {session.activityTitle ||
                            "Completed Activity"}
                        </strong>

                        <span>
                          {session.learnerName ||
                            "Learner"}

                          {session.topic
                            ? ` · ${session.topic}`
                            : ""}
                        </span>

                      </div>

                      <div className="teacher-dashboard-result-score">

                        <strong>
                          {score}
                          {" / "}
                          {
                            session.totalQuestions
                          }
                        </strong>

                        <span>
                          {accuracy ===
                          null
                            ? "Score recorded"
                            : `${accuracy}% accuracy`}
                        </span>

                      </div>

                      <div className="teacher-dashboard-result-date">
                        {formatDateTime(
                          session.endedAt
                        )}
                      </div>

                      <div className="teacher-dashboard-result-arrow">
                        ›
                      </div>

                    </button>
                  );
                }
              )}

            </div>
          )}

      </section>

    </TeacherLayout>
  );
}

export default TeacherDashboardPage;