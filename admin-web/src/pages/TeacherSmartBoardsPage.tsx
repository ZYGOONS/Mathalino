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

import "./TeacherSmartBoardsPage.css";

type BoardAction =
  | "deactivate"
  | "reactivate"
  | "unlink";

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

interface BoardActionTarget {
  board: SmartBoard;
  action: BoardAction;
}

interface LinkBoardForm {
  boardId: string;
  pairingCode: string;
  name: string;
  room: string;
}

function isBoardBusy(
  board: SmartBoard
): boolean {
  return (
    board.status === "in_session" ||
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
    board.status === "inactive"
  ) {
    return "Deactivated";
  }

  if (
    board.status === "available"
  ) {
    return "Available for a session";
  }

  return "Not available";
}

function getBoardAction(
  board: SmartBoard
): BoardAction {
  if (
    !board.enabled ||
    (
      board.status !== "available" &&
      !isBoardBusy(board)
    )
  ) {
    return "reactivate";
  }

  return "deactivate";
}

function getActionLabel(
  action: BoardAction
): string {
  switch (action) {
    case "deactivate":
      return "Deactivate";

    case "reactivate":
      return "Reactivate";

    case "unlink":
      return "Unlink";
  }
}

function getActionExplanation(
  action: BoardAction
): string {
  switch (action) {
    case "deactivate":
      return "This board will not be selectable for learning sessions or RFID card linking.";

    case "reactivate":
      return "This board will become selectable again. Reactivating does not confirm that the physical board is online.";

    case "unlink":
      return "Another teacher with the board's pairing code may link it afterward. Your learners and previous results will remain in your account.";
  }
}

function normalizeBoardId(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

function normalizePairingCode(
  value: string
): string {
  return value
    .toUpperCase()
    .replace(
      /[\s-]/g,
      ""
    );
}

function getErrorMessage(
  error: unknown
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const firebaseError =
      error as {
        code?: string;
        message?: string;
      };

    if (
      firebaseError.code ===
      "permission-denied"
    ) {
      return "Could not link or update this board. Check the pairing code and board setup.";
    }

    if (
      firebaseError.code ===
        "unavailable" ||
      firebaseError.code ===
        "deadline-exceeded"
    ) {
      return "Check your connection and try again.";
    }
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return "Could not update the board. Please try again.";
}

function TeacherSmartBoardsPage() {
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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    linkDialogOpen,
    setLinkDialogOpen,
  ] =
    useState(false);

  const [
    linking,
    setLinking,
  ] =
    useState(false);

  const [
    linkError,
    setLinkError,
  ] =
    useState("");

  const [
    linkForm,
    setLinkForm,
  ] =
    useState<LinkBoardForm>({
      boardId: "",
      pairingCode: "",
      name: "",
      room: "",
    });

  const [
    actionTarget,
    setActionTarget,
  ] =
    useState<BoardActionTarget | null>(
      null
    );

  const [
    processingAction,
    setProcessingAction,
  ] =
    useState(false);

  /*
   * =========================
   * LOAD TEACHER BOARDS
   * =========================
   */

  useEffect(() => {
    let unsubscribeBoards:
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

          setLoading(true);
          setError("");

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
                const boardList:
                  SmartBoard[] =
                  snapshot.docs
                    .map(
                      (
                        boardDocument
                      ) => {
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
                      (board) =>
                        board.linked
                    );

                setBoards(
                  boardList
                );

                setLoading(
                  false
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
                  "Could not load boards. Check your connection and permissions."
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

      if (
        unsubscribeBoards
      ) {
        unsubscribeBoards();
      }
    };
  }, [navigate]);

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
   * LINK SMART BOARD
   * =========================
   */

  const handleLinkBoard =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        navigate("/");
        return;
      }

      const boardId =
        normalizeBoardId(
          linkForm.boardId
        );

      const pairingCode =
        normalizePairingCode(
          linkForm.pairingCode
        );

      const name =
        linkForm.name.trim();

      const room =
        linkForm.room.trim();

      if (
        !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(
          boardId
        ) ||
        !/^[A-F0-9]{16}$/.test(
          pairingCode
        )
      ) {
        setLinkError(
          "Enter the board ID and 16-character pairing code."
        );

        return;
      }

      if (
        !name ||
        name.length > 80 ||
        room.length > 80
      ) {
        setLinkError(
          "Enter a board name and keep the board name and room under 80 characters."
        );

        return;
      }

      try {
        setLinking(true);
        setLinkError("");

        await runTransaction(
          db,
          async (
            transaction
          ) => {
            const pairingReference =
              doc(
                db,
                "boardPairingCodes",
                pairingCode
              );

            const pairingSnapshot =
              await transaction.get(
                pairingReference
              );

            if (
              !pairingSnapshot.exists() ||
              pairingSnapshot.data()
                .boardId !==
                boardId ||
              pairingSnapshot.data()
                .enabled !==
                true
            ) {
              throw new Error(
                "Board ID or pairing code is incorrect."
              );
            }

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

            if (
              boardSnapshot.exists()
            ) {
              const boardData =
                boardSnapshot.data();

              if (
                boardData.status ===
                  "in_session" ||
                Boolean(
                  boardData.currentSessionId
                )
              ) {
                throw new Error(
                  "Complete or cancel the active session first."
                );
              }

              if (
                boardData.linked !==
                false
              ) {
                if (
                  boardData.teacherId !==
                  user.uid
                ) {
                  throw new Error(
                    "The current teacher must unlink this board first."
                  );
                }

                return;
              }
            }

            const claimReference =
              doc(
                db,
                "boardPairingClaims",
                `${boardId}_${user.uid}`
              );

            const deviceReference =
              doc(
                db,
                "devices",
                boardId
              );

            transaction.set(
              claimReference,
              {
                boardId,

                teacherId:
                  user.uid,

                code:
                  pairingCode,

                updatedAt:
                  serverTimestamp(),
              }
            );

            transaction.set(
              boardReference,
              {
                teacherId:
                  user.uid,

                name,

                room,

                linked:
                  true,

                enabled:
                  true,

                status:
                  "available",

                currentSessionId:
                  null,

                lastSeenAt:
                  null,

                registeredAt:
                  serverTimestamp(),

                updatedAt:
                  serverTimestamp(),
              }
            );

            transaction.update(
              deviceReference,
              {
                teacherId:
                  user.uid,

                updatedAt:
                  serverTimestamp(),
              }
            );
          }
        );

        setLinkForm({
          boardId: "",
          pairingCode: "",
          name: "",
          room: "",
        });

        setLinkDialogOpen(
          false
        );
      } catch (
        linkBoardError
      ) {
        console.error(
          "Could not link board:",
          linkBoardError
        );

        setLinkError(
          getErrorMessage(
            linkBoardError
          )
        );
      } finally {
        setLinking(
          false
        );
      }
    };

  /*
   * =========================
   * BOARD MANAGEMENT
   * =========================
   */

  const handleBoardAction =
    async () => {
      const user =
        auth.currentUser;

      if (
        !user ||
        !actionTarget
      ) {
        return;
      }

      const {
        board,
        action,
      } =
        actionTarget;

      try {
        setProcessingAction(
          true
        );

        setError("");

        await runTransaction(
          db,
          async (
            transaction
          ) => {
            const boardReference =
              doc(
                db,
                "boards",
                board.id
              );

            const boardSnapshot =
              await transaction.get(
                boardReference
              );

            if (
              !boardSnapshot.exists()
            ) {
              throw new Error(
                "This board could not be found."
              );
            }

            const boardData =
              boardSnapshot.data();

            if (
              boardData.teacherId !==
              user.uid
            ) {
              throw new Error(
                "This board is not linked to your account."
              );
            }

            if (
              boardData.status ===
                "in_session" ||
              Boolean(
                boardData.currentSessionId
              )
            ) {
              throw new Error(
                "Complete or cancel the active session first."
              );
            }

            if (
              boardData.linked ===
              false
            ) {
              throw new Error(
                "Link this board using its pairing code first."
              );
            }

            const isUnlink =
              action ===
              "unlink";

            const isReactivate =
              action ===
              "reactivate";

            transaction.update(
              boardReference,
              {
                linked:
                  !isUnlink,

                enabled:
                  isReactivate,

                status:
                  isUnlink
                    ? "unlinked"
                    : isReactivate
                      ? "available"
                      : "inactive",

                updatedAt:
                  serverTimestamp(),
              }
            );

            if (isUnlink) {
              transaction.update(
                doc(
                  db,
                  "devices",
                  board.id
                ),
                {
                  teacherId:
                    "",

                  updatedAt:
                    serverTimestamp(),
                }
              );
            }
          }
        );

        setActionTarget(
          null
        );
      } catch (
        boardActionError
      ) {
        console.error(
          "Could not update board:",
          boardActionError
        );

        setError(
          getErrorMessage(
            boardActionError
          )
        );

        setActionTarget(
          null
        );
      } finally {
        setProcessingAction(
          false
        );
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-boards-heading">

        <div>

          <span className="teacher-boards-eyebrow">
            SMART BOARD MANAGEMENT
          </span>

          <h2>
            Smart Boards
          </h2>

          <p>
            Link and manage Smart Boards
            assigned to your teacher account.
          </p>

        </div>

        <button
          type="button"
          className="teacher-board-link-button"
          onClick={() => {
            setLinkError(
              ""
            );

            setLinkDialogOpen(
              true
            );
          }}
        >
          + Link Smart Board
        </button>

      </div>

      {error && (
        <div
          className="teacher-boards-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {telemetryError && (
        <div
          className="teacher-boards-error"
          role="alert"
        >
          {telemetryError}
        </div>
      )}

      {loading && (
        <div className="teacher-boards-state">
          Loading Smart Boards...
        </div>
      )}

      {!loading &&
        sortedBoards.length ===
          0 && (
          <section className="teacher-boards-empty">

            <div className="teacher-boards-empty-icon">
              ▣
            </div>

            <h3>
              No Smart Boards linked
            </h3>

            <p>
              Link a Mathalino Smart Board
              using its Board ID and pairing
              code.
            </p>

            <button
              type="button"
              onClick={() =>
                setLinkDialogOpen(
                  true
                )
              }
            >
              Link Smart Board
            </button>

          </section>
        )}

      {!loading &&
        sortedBoards.length >
          0 && (
          <section className="teacher-boards-grid">

            {sortedBoards.map(
              (
                board
              ) => {
                const busy =
                  isBoardBusy(
                    board
                  );

                const primaryAction =
                  getBoardAction(
                    board
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
                    board.currentSessionId
                  );

                const showBoardScreen =
                  Boolean(
                    boardDisplayText
                  ) ||
                  busy;

                return (
                  <article
                    key={
                      board.id
                    }
                    className="teacher-board-card"
                  >

                    <div className="teacher-board-card-top">

                      <div>

                        <span className="teacher-board-label">
                          SMART BOARD
                        </span>

                        <h3>
                          {board.name ||
                            board.id}
                        </h3>

                        {board.room && (
                          <p>
                            {
                              board.room
                            }
                          </p>
                        )}

                      </div>

                      <span
                        className={
                          busy
                            ? "teacher-board-status busy"
                            : board.enabled &&
                                board.status ===
                                  "available"
                              ? "teacher-board-status available"
                              : "teacher-board-status inactive"
                        }
                      >
                        {getBoardAvailability(
                          board
                        )}
                      </span>

                    </div>

                    <div className="teacher-board-info">

                      <div>

                        <span>
                          BOARD ID
                        </span>

                        <strong>
                          {
                            board.id
                          }
                        </strong>

                      </div>

                      <div>

                        <span>
                          CONNECTION
                        </span>

                        <strong
                          className={
                            connectionStatus ===
                            "Connected"
                              ? "teacher-board-connection connected"
                              : connectionStatus ===
                                  "Connection unknown"
                                ? "teacher-board-connection unknown"
                                : "teacher-board-connection stale"
                          }
                        >
                          {
                            connectionStatus
                          }
                        </strong>

                      </div>

                      {busy && (
                        <div>

                          <span>
                            CURRENT SESSION
                          </span>

                          <strong>
                            {board.currentSessionId ||
                              "Active"}
                          </strong>

                        </div>
                      )}

                    </div>

                    {showBoardScreen && (
                      <div className="teacher-board-screen-section">

                        <span className="teacher-board-screen-label">
                          {connectionStatus ===
                          "Connected"
                            ? "BOARD SCREEN"
                            : "LAST BOARD SCREEN"}
                        </span>

                        <div className="teacher-board-screen">

                          {boardDisplayText ||
                            "Waiting for board..."}

                        </div>

                      </div>
                    )}

                    <div className="teacher-board-actions">

                      <button
                        type="button"
                        className="teacher-board-secondary-action"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          setActionTarget(
                            {
                              board,

                              action:
                                primaryAction,
                            }
                          )
                        }
                      >
                        {getActionLabel(
                          primaryAction
                        )}
                      </button>

                      <button
                        type="button"
                        className="teacher-board-danger-action"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          setActionTarget(
                            {
                              board,

                              action:
                                "unlink",
                            }
                          )
                        }
                      >
                        Unlink
                      </button>

                    </div>

                    {busy && (
                      <p className="teacher-board-busy-note">
                        Complete or cancel the
                        active learning session
                        before changing this
                        board.
                      </p>
                    )}

                  </article>
                );
              }
            )}

          </section>
        )}

      {/* =========================
          LINK BOARD DIALOG
          ========================= */}

      {linkDialogOpen && (
        <div
          className="teacher-board-modal-backdrop"
          role="presentation"
        >

          <div
            className="teacher-board-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-board-title"
          >

            <div className="teacher-board-modal-header">

              <div>

                <span>
                  SMART BOARD
                </span>

                <h3 id="link-board-title">
                  Link Smart Board
                </h3>

              </div>

              <button
                type="button"
                className="teacher-board-modal-close"
                disabled={
                  linking
                }
                onClick={() =>
                  setLinkDialogOpen(
                    false
                  )
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>

            <div className="teacher-board-form">

              <div className="teacher-board-form-field">

                <label htmlFor="board-id">
                  Board ID
                </label>

                <input
                  id="board-id"
                  type="text"
                  value={
                    linkForm.boardId
                  }
                  placeholder="Example: MATHBOARD01"
                  disabled={
                    linking
                  }
                  onChange={(
                    event
                  ) =>
                    setLinkForm(
                      (
                        current
                      ) => ({
                        ...current,

                        boardId:
                          event.target.value,
                      })
                    )
                  }
                />

              </div>

              <div className="teacher-board-form-field">

                <label htmlFor="pairing-code">
                  Pairing Code
                </label>

                <input
                  id="pairing-code"
                  type="password"
                  value={
                    linkForm.pairingCode
                  }
                  placeholder="16-character pairing code"
                  disabled={
                    linking
                  }
                  onChange={(
                    event
                  ) =>
                    setLinkForm(
                      (
                        current
                      ) => ({
                        ...current,

                        pairingCode:
                          event.target.value,
                      })
                    )
                  }
                />

              </div>

              <div className="teacher-board-form-field">

                <label htmlFor="board-name">
                  Board Name
                </label>

                <input
                  id="board-name"
                  type="text"
                  value={
                    linkForm.name
                  }
                  placeholder="Example: Grade 2 Board"
                  disabled={
                    linking
                  }
                  onChange={(
                    event
                  ) =>
                    setLinkForm(
                      (
                        current
                      ) => ({
                        ...current,

                        name:
                          event.target.value,
                      })
                    )
                  }
                />

              </div>

              <div className="teacher-board-form-field">

                <label htmlFor="board-room">
                  Room
                </label>

                <input
                  id="board-room"
                  type="text"
                  value={
                    linkForm.room
                  }
                  placeholder="Optional room name"
                  disabled={
                    linking
                  }
                  onChange={(
                    event
                  ) =>
                    setLinkForm(
                      (
                        current
                      ) => ({
                        ...current,

                        room:
                          event.target.value,
                      })
                    )
                  }
                />

              </div>

              {linkError && (
                <div
                  className="teacher-board-form-error"
                  role="alert"
                >
                  {linkError}
                </div>
              )}

            </div>

            <div className="teacher-board-modal-actions">

              <button
                type="button"
                className="teacher-board-modal-cancel"
                disabled={
                  linking
                }
                onClick={() =>
                  setLinkDialogOpen(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="teacher-board-modal-confirm"
                disabled={
                  linking
                }
                onClick={() => {
                  void handleLinkBoard();
                }}
              >
                {linking
                  ? "Linking..."
                  : "Link Board"}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =========================
          BOARD ACTION DIALOG
          ========================= */}

      {actionTarget && (
        <div
          className="teacher-board-modal-backdrop"
          role="presentation"
        >

          <div
            className="teacher-board-modal teacher-board-confirm-modal"
            role="dialog"
            aria-modal="true"
          >

            <span className="teacher-board-confirm-label">
              CONFIRM ACTION
            </span>

            <h3>
              {getActionLabel(
                actionTarget.action
              )}{" "}
              {actionTarget.board.name ||
                actionTarget.board.id}
              ?
            </h3>

            <p>
              {getActionExplanation(
                actionTarget.action
              )}
            </p>

            <div className="teacher-board-modal-actions">

              <button
                type="button"
                className="teacher-board-modal-cancel"
                disabled={
                  processingAction
                }
                onClick={() =>
                  setActionTarget(
                    null
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  actionTarget.action ===
                  "unlink"
                    ? "teacher-board-modal-confirm danger"
                    : "teacher-board-modal-confirm"
                }
                disabled={
                  processingAction
                }
                onClick={() => {
                  void handleBoardAction();
                }}
              >
                {processingAction
                  ? "Updating..."
                  : getActionLabel(
                      actionTarget.action
                    )}
              </button>

            </div>

          </div>

        </div>
      )}

    </TeacherLayout>
  );
}

export default TeacherSmartBoardsPage;