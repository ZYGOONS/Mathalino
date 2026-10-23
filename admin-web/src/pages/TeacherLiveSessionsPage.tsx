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

import {
  getBoardConnectionStatus,
  getBoardDisplayText,
  useBoardTelemetry,
} from "../hooks/useBoardTelemetry";

import "./TeacherLiveSessionsPage.css";

interface SmartBoard {
  id: string;
  teacherId: string;
  name: string;
  room: string;
  status: string;

  currentSessionId:
    | string
    | null;

  enabled: boolean;
  linked: boolean;
}

interface LiveSession {
  id: string;

  teacherId: string;

  boardId: string;
  boardName: string;

  learnerId: string;
  learnerName: string;

  assignmentId:
    | string
    | null;

  activityId: string;
  activityTitle: string;

  topic: string;
  difficulty: string;

  connectionMethod: string;

  status: string;

  currentQuestion: number;
  totalQuestions: number;

  correctAnswers: number;
  unsuccessfulAnswers: number;
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

function getBoardAvailability(
  board: SmartBoard
): string {
  if (!board.linked) {
    return "Unlinked";
  }

  if (isBoardBusy(board)) {
    return "In session";
  }

  if (
    !board.enabled ||
    board.status ===
      "inactive"
  ) {
    return "Deactivated";
  }

  if (
    board.status ===
    "available"
  ) {
    return "Available for a session";
  }

  return "Not available — reactivate to enable selection";
}

function getProgress(
  currentQuestion: number,
  totalQuestions: number
): {
  completed: number;
  percentage: number;
} {
  if (
    totalQuestions <= 0
  ) {
    return {
      completed: 0,
      percentage: 0,
    };
  }

  const completed =
    Math.min(
      Math.max(
        currentQuestion - 1,
        0
      ),
      totalQuestions
    );

  return {
    completed,

    percentage:
      (completed /
        totalQuestions) *
      100,
  };
}

function getErrorMessage(
  error: unknown
): string {
  if (
    typeof error ===
      "object" &&
    error !== null &&
    "code" in error
  ) {
    const firebaseError =
      error as {
        code?: string;
      };

    if (
      firebaseError.code ===
      "permission-denied"
    ) {
      return "The session could not be updated. Check your account access and Firestore rules.";
    }

    if (
      firebaseError.code ===
        "unavailable" ||
      firebaseError.code ===
        "deadline-exceeded"
    ) {
      return "Check your internet connection and try again.";
    }
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return "The session could not be updated.";
}

function TeacherLiveSessionsPage() {
  const navigate =
    useNavigate();

  const {
    telemetryByBoardId,
    nowMs,
    telemetryError,
  } =
    useBoardTelemetry();

  const [
    boards,
    setBoards,
  ] =
    useState<SmartBoard[]>(
      []
    );

  const [
    sessions,
    setSessions,
  ] =
    useState<LiveSession[]>(
      []
    );

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

  const [
    cancelTarget,
    setCancelTarget,
  ] =
    useState<LiveSession | null>(
      null
    );

  const [
    cancellingSessionId,
    setCancellingSessionId,
  ] =
    useState<string | null>(
      null
    );

  /*
   * =========================
   * FIRESTORE LISTENERS
   * =========================
   */

  useEffect(() => {
    let unsubscribeBoards:
      | (() => void)
      | undefined;

    let unsubscribeSessions:
      | (() => void)
      | undefined;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            navigate("/");
            return;
          }

          setError("");

          setBoardsLoaded(
            false
          );

          setSessionsLoaded(
            false
          );

          /*
           * Same approach as Android:
           * load all teacher-owned boards
           * and filter linked boards.
           */

          const boardsQuery =
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
            );

          unsubscribeBoards =
            onSnapshot(
              boardsQuery,
              (
                snapshot
              ) => {
                const nextBoards =
                  snapshot.docs
                    .map(
                      (
                        boardDocument
                      ): SmartBoard => {
                        const data =
                          boardDocument.data();

                        return {
                          id:
                            boardDocument.id,

                          teacherId:
                            data.teacherId ??
                            "",

                          name:
                            data.name ??
                            "",

                          room:
                            data.room ??
                            "",

                          status:
                            data.status ??
                            "offline",

                          currentSessionId:
                            data.currentSessionId ??
                            null,

                          enabled:
                            data.enabled ??
                            true,

                          linked:
                            data.linked ??
                            true,
                        };
                      }
                    )
                    .filter(
                      (
                        board
                      ) =>
                        board.linked
                    );

                setBoards(
                  nextBoards
                );

                setBoardsLoaded(
                  true
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  "Could not load boards:",
                  snapshotError
                );

                setError(
                  "Could not load Smart Boards. Check your connection and account access."
                );

                setBoardsLoaded(
                  false
                );
              }
            );

          /*
           * Android reads all sessions
           * owned by the teacher and then
           * matches the active session
           * using board.currentSessionId.
           */

          const sessionsQuery =
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
            );

          unsubscribeSessions =
            onSnapshot(
              sessionsQuery,
              (
                snapshot
              ) => {
                const nextSessions =
                  snapshot.docs.map(
                    (
                      sessionDocument
                    ): LiveSession => {
                      const data =
                        sessionDocument.data();

                      return {
                        id:
                          sessionDocument.id,

                        teacherId:
                          data.teacherId ??
                          "",

                        boardId:
                          data.boardId ??
                          "",

                        boardName:
                          data.boardName ??
                          "",

                        learnerId:
                          data.learnerId ??
                          "",

                        learnerName:
                          data.learnerName ??
                          "",

                        assignmentId:
                          data.assignmentId ??
                          null,

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

                        connectionMethod:
                          data.connectionMethod ??
                          "manual",

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

                        unsuccessfulAnswers:
                          Number(
                            data.unsuccessfulAnswers ??
                              0
                          ),
                      };
                    }
                  );

                setSessions(
                  nextSessions
                );

                setSessionsLoaded(
                  true
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  "Could not load live sessions:",
                  snapshotError
                );

                setError(
                  "Could not load live learning sessions. Check your connection and account access."
                );

                setSessionsLoaded(
                  false
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      if (
        unsubscribeBoards
      ) {
        unsubscribeBoards();
      }

      if (
        unsubscribeSessions
      ) {
        unsubscribeSessions();
      }
    };
  }, [navigate]);

  /*
   * =========================
   * SORT BOARDS
   * =========================
   */

  const sortedBoards =
    useMemo(
      () =>
        [...boards].sort(
          (
            first,
            second
          ) =>
            (
              first.name ||
              first.id
            ).localeCompare(
              second.name ||
                second.id
            )
        ),
      [boards]
    );

  /*
   * =========================
   * CANCEL SESSION
   * =========================
   */

  const handleCancelSession =
    async () => {
      const user =
        auth.currentUser;

      if (
        !user ||
        !cancelTarget
      ) {
        return;
      }

      const sessionId =
        cancelTarget.id;

      try {
        setCancellingSessionId(
          sessionId
        );

        setError("");

        await runTransaction(
          db,
          async (
            transaction
          ) => {
            /*
             * Read session first.
             */

            const sessionReference =
              doc(
                db,
                "liveSessions",
                sessionId
              );

            const sessionSnapshot =
              await transaction.get(
                sessionReference
              );

            if (
              !sessionSnapshot.exists()
            ) {
              throw new Error(
                "Session was not found."
              );
            }

            const sessionData =
              sessionSnapshot.data();

            if (
              sessionData.teacherId !==
              user.uid
            ) {
              throw new Error(
                "Session is not owned by this teacher."
              );
            }

            if (
              sessionData.status !==
                "active" &&
              sessionData.status !==
                "cancelled"
            ) {
              throw new Error(
                "Session has already ended."
              );
            }

            const boardId =
              sessionData.boardId;

            if (
              !boardId
            ) {
              throw new Error(
                "Session board is missing."
              );
            }

            /*
             * Read board before writing.
             */

            const boardReference =
              doc(
                db,
                "boards",
                boardId
              );

            const boardSnapshot =
              await transaction.get(
                boardReference
              );

            /*
             * Read assignment before
             * doing any writes.
             */

            const assignmentId =
              sessionData.assignmentId;

            const assignmentReference =
              assignmentId
                ? doc(
                    db,
                    "assignments",
                    assignmentId
                  )
                : null;

            const assignmentSnapshot =
              assignmentReference
                ? await transaction.get(
                    assignmentReference
                  )
                : null;

            /*
             * Same ownership protection
             * as Android.
             */

            if (
              boardSnapshot.exists() &&
              boardSnapshot.data()
                .teacherId !==
                user.uid
            ) {
              throw new Error(
                "Board ownership has changed."
              );
            }

            /*
             * Return unfinished assignment
             * from in_progress -> assigned.
             *
             * This allows the learner to
             * tap their RFID card again.
             */

            if (
              assignmentReference &&
              assignmentSnapshot?.exists() &&
              assignmentSnapshot.data()
                .teacherId ===
                user.uid &&
              assignmentSnapshot.data()
                .currentSessionId ===
                sessionId &&
              assignmentSnapshot.data()
                .status ===
                "in_progress"
            ) {
              transaction.update(
                assignmentReference,
                {
                  status:
                    "assigned",

                  currentSessionId:
                    null,

                  updatedAt:
                    serverTimestamp(),
                }
              );
            }

            /*
             * Cancel active session.
             */

            if (
              sessionData.status ===
              "active"
            ) {
              transaction.update(
                sessionReference,
                {
                  status:
                    "cancelled",

                  endedAt:
                    serverTimestamp(),

                  updatedAt:
                    serverTimestamp(),
                }
              );
            }

            /*
             * Release board only if
             * it still owns THIS session.
             *
             * This prevents an old retry
             * from releasing a newer session.
             */

            if (
              boardSnapshot.exists() &&
              boardSnapshot.data()
                .currentSessionId ===
                sessionId
            ) {
              transaction.update(
                boardReference,
                {
                  status:
                    "available",

                  currentSessionId:
                    null,
                }
              );
            }
          }
        );

        setCancelTarget(
          null
        );
      } catch (
        cancelError
      ) {
        console.error(
          "Could not cancel session:",
          cancelError
        );

        setError(
          getErrorMessage(
            cancelError
          )
        );

        setCancelTarget(
          null
        );
      } finally {
        setCancellingSessionId(
          null
        );
      }
    };

  const loading =
    !boardsLoaded ||
    !sessionsLoaded;

  return (
    <TeacherLayout>

      <div className="teacher-live-heading">

        <div>

          <span className="teacher-live-eyebrow">
            SMART BOARD MONITORING
          </span>

          <h2>
            Live Learning Sessions
          </h2>

          <p>
            Monitor learners currently
            using your linked Mathalino
            Smart Boards.
          </p>

        </div>

        <div className="teacher-live-summary">

          <strong>
            {
              boards.filter(
                (
                  board
                ) =>
                  Boolean(
                    sessions.find(
                      (
                        session
                      ) =>
                        session.id ===
                          board.currentSessionId &&
                        session.status ===
                          "active"
                    )
                  )
              ).length
            }
          </strong>

          <span>
            Active Sessions
          </span>

        </div>

      </div>

      <div className="teacher-live-notice">

        Active Smart Board sessions
        appear here automatically in
        real time.

      </div>

      {error && (
        <div
          className="teacher-live-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {telemetryError && (
        <div
          className="teacher-live-error"
          role="alert"
        >
          {telemetryError}
        </div>
      )}

      {loading && (
        <div className="teacher-live-loading">
          Loading boards and sessions...
        </div>
      )}

      {!loading &&
        sortedBoards.length ===
          0 && (
          <section className="teacher-live-empty">

            <div className="teacher-live-empty-icon">
              ▣
            </div>

            <h3>
              No linked Smart Boards
            </h3>

            <p>
              Link a Smart Board first
              before monitoring live
              learning sessions.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/teacher/boards"
                )
              }
            >
              Go to Smart Boards
            </button>

          </section>
        )}

      {!loading &&
        sortedBoards.length >
          0 && (
          <section className="teacher-live-board-list">

            {sortedBoards.map(
              (
                board
              ) => {
                /*
                 * Exact Android matching:
                 *
                 * board.currentSessionId
                 * must point to a session
                 * whose status is active.
                 */

                const activeSession =
                  sessions.find(
                    (
                      session
                    ) =>
                      session.id ===
                        board.currentSessionId &&
                      session.status ===
                        "active"
                  );

                const telemetry =
                  telemetryByBoardId[
                    board.id
                  ];

                const connectionStatus =
                  getBoardConnectionStatus(
                    telemetry,
                    nowMs
                  );

                const boardDisplayText =
                  getBoardDisplayText(
                    telemetry,
                    activeSession?.id ??
                      board.currentSessionId
                  );

                const showBoardScreen =
                  Boolean(
                    boardDisplayText
                  ) ||
                  Boolean(
                    activeSession
                  );

                const progress =
                  activeSession
                    ? getProgress(
                        activeSession.currentQuestion,
                        activeSession.totalQuestions
                      )
                    : {
                        completed:
                          0,

                        percentage:
                          0,
                      };

                const boardName =
                  board.name.trim() ||
                  board.id;

                return (
                  <article
                    key={
                      board.id
                    }
                    className={
                      activeSession
                        ? "teacher-live-card active"
                        : "teacher-live-card"
                    }
                  >

                    <div className="teacher-live-card-header">

                      <div>

                        <span className="teacher-live-card-label">
                          SMART BOARD
                        </span>

                        <h3>
                          {boardName}
                        </h3>

                        {boardName !==
                          board.id && (
                          <p className="teacher-live-board-id">
                            {
                              board.id
                            }
                          </p>
                        )}

                        {board.room && (
                          <p className="teacher-live-room">
                            {
                              board.room
                            }
                          </p>
                        )}

                      </div>

                      <div className="teacher-live-card-statuses">

                        <span
                          className={
                            connectionStatus ===
                            "Connected"
                              ? "teacher-live-connection connected"
                              : connectionStatus ===
                                  "Connection unknown"
                                ? "teacher-live-connection unknown"
                                : "teacher-live-connection stale"
                          }
                        >
                          {
                            connectionStatus
                          }
                        </span>

                        {activeSession && (
                          <span className="teacher-live-active-badge">
                            LIVE
                          </span>
                        )}

                      </div>

                    </div>

                    {!activeSession && (
                      <div className="teacher-live-idle">

                        <span>
                          BOARD STATUS
                        </span>

                        <strong>
                          {getBoardAvailability(
                            board
                          )}
                        </strong>

                        <p>
                          No learner is
                          currently using this
                          board.
                        </p>

                      </div>
                    )}

                    {activeSession && (
                      <>

                        <div className="teacher-live-session-main">

                          <div className="teacher-live-session-person">

                            <span>
                              LEARNER
                            </span>

                            <h4>
                              {activeSession.learnerName ||
                                "Learner"}
                            </h4>

                          </div>

                          <div className="teacher-live-session-activity">

                            <span>
                              ACTIVITY
                            </span>

                            <strong>
                              {activeSession.activityTitle ||
                                "Activity"}
                            </strong>

                            {activeSession.topic && (
                              <small>
                                {
                                  activeSession.topic
                                }
                              </small>
                            )}

                          </div>

                        </div>

                        <div className="teacher-live-progress-section">

                          <div className="teacher-live-progress-heading">

                            <div>

                              <span>
                                PROGRESS
                              </span>

                              <strong>
                                {activeSession.totalQuestions >
                                0
                                  ? `Question ${activeSession.currentQuestion} of ${activeSession.totalQuestions}`
                                  : "Starting..."}
                              </strong>

                            </div>

                            {activeSession.totalQuestions >
                              0 && (
                              <span className="teacher-live-progress-count">
                                {
                                  progress.completed
                                }
                                /
                                {
                                  activeSession.totalQuestions
                                }{" "}
                                completed
                              </span>
                            )}

                          </div>

                          {activeSession.totalQuestions >
                            0 && (
                            <div
                              className="teacher-live-progress-track"
                              role="progressbar"
                              aria-valuemin={
                                0
                              }
                              aria-valuemax={
                                activeSession.totalQuestions
                              }
                              aria-valuenow={
                                progress.completed
                              }
                              aria-label={`${progress.completed} of ${activeSession.totalQuestions} questions completed`}
                            >

                              <div
                                className="teacher-live-progress-fill"
                                style={{
                                  width:
                                    `${progress.percentage}%`,
                                }}
                              />

                            </div>
                          )}

                        </div>

                      </>
                    )}

                    {showBoardScreen && (
                      <div className="teacher-live-screen-section">

                        <span className="teacher-live-screen-label">
                          {connectionStatus ===
                          "Connected"
                            ? "BOARD SCREEN"
                            : "LAST BOARD SCREEN"}
                        </span>

                        <div className="teacher-live-screen">

                          {boardDisplayText ||
                            "Waiting for board..."}

                        </div>

                      </div>
                    )}

                    {activeSession && (
                      <div className="teacher-live-actions">

                        <button
                          type="button"
                          className="teacher-live-cancel-button"
                          disabled={
                            cancellingSessionId ===
                            activeSession.id
                          }
                          onClick={() =>
                            setCancelTarget(
                              activeSession
                            )
                          }
                        >
                          {cancellingSessionId ===
                          activeSession.id
                            ? "Cancelling..."
                            : "Cancel Session"}
                        </button>

                      </div>
                    )}

                  </article>
                );
              }
            )}

          </section>
        )}

      {/* =========================
          CANCEL SESSION MODAL
          ========================= */}

      {cancelTarget && (
        <div
          className="teacher-live-modal-backdrop"
          role="presentation"
        >

          <div
            className="teacher-live-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-session-title"
          >

            <span className="teacher-live-modal-label">
              LIVE SESSION
            </span>

            <h3 id="cancel-session-title">
              Cancel this session?
            </h3>

            <p>
              The learner can tap their
              card again to restart the
              unfinished activity.
            </p>

            <div className="teacher-live-modal-details">

              <div>

                <span>
                  Learner
                </span>

                <strong>
                  {cancelTarget.learnerName ||
                    "Learner"}
                </strong>

              </div>

              <div>

                <span>
                  Activity
                </span>

                <strong>
                  {cancelTarget.activityTitle ||
                    "Activity"}
                </strong>

              </div>

            </div>

            <div className="teacher-live-modal-actions">

              <button
                type="button"
                className="teacher-live-keep-button"
                disabled={
                  cancellingSessionId ===
                  cancelTarget.id
                }
                onClick={() =>
                  setCancelTarget(
                    null
                  )
                }
              >
                Keep Learning
              </button>

              <button
                type="button"
                className="teacher-live-confirm-cancel"
                disabled={
                  cancellingSessionId ===
                  cancelTarget.id
                }
                onClick={() => {
                  void handleCancelSession();
                }}
              >
                {cancellingSessionId ===
                cancelTarget.id
                  ? "Cancelling..."
                  : "Cancel Session"}
              </button>

            </div>

          </div>

        </div>
      )}

    </TeacherLayout>
  );
}

export default TeacherLiveSessionsPage;