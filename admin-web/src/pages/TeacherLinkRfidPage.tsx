import {
  useEffect,
  useMemo,
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
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherLinkRfidPage.css";

interface Learner {
  id: string;
  teacherId: string;

  firstName: string;
  lastName: string;

  rfidUid:
    | string
    | null;
}

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

interface RfidScan {
  id: string;

  teacherId: string;
  boardId: string;

  uid: string;

  readerId: number;

  consumed: boolean;

  scannedAt:
    | Timestamp
    | null;
}

function boardBusy(
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

function boardSelectable(
  board: SmartBoard
): boolean {
  return (
    board.linked &&
    board.enabled &&
    board.status ===
      "available" &&
    !boardBusy(
      board
    )
  );
}

function learnerName(
  learner:
    Learner | null
): string {
  if (!learner) {
    return "";
  }

  return [
    learner.firstName,
    learner.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function TeacherLinkRfidPage() {
  const navigate =
    useNavigate();

  const {
    learnerId,
  } =
    useParams<{
      learnerId: string;
    }>();

  const [
    learner,
    setLearner,
  ] =
    useState<Learner | null>(
      null
    );

  const [
    boards,
    setBoards,
  ] =
    useState<SmartBoard[]>(
      []
    );

  const [
    selectedBoardId,
    setSelectedBoardId,
  ] =
    useState("");

  const [
    detectedScan,
    setDetectedScan,
  ] =
    useState<RfidScan | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    linking,
    setLinking,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  /*
   * =========================
   * LOAD LEARNER + BOARDS
   * =========================
   */

  useEffect(() => {
    if (!learnerId) {
      navigate(
        "/teacher/learners"
      );

      return;
    }

    let unsubscribeBoards:
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

          try {
            setLoading(
              true
            );

            const learnerSnapshot =
              await getDoc(
                doc(
                  db,
                  "learners",
                  learnerId
                )
              );

            if (
              !learnerSnapshot.exists()
            ) {
              throw new Error(
                "Learner was not found."
              );
            }

            const learnerData =
              learnerSnapshot.data();

            if (
              learnerData.teacherId !==
              user.uid
            ) {
              throw new Error(
                "This learner does not belong to your account."
              );
            }

            setLearner({
              id:
                learnerSnapshot.id,

              teacherId:
                learnerData.teacherId ??
                "",

              firstName:
                learnerData.firstName ??
                "",

              lastName:
                learnerData.lastName ??
                "",

              rfidUid:
                learnerData.rfidUid ??
                null,
            });

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
                  const available =
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
                        boardSelectable
                      );

                  setBoards(
                    available
                  );

                  /*
                   * Android automatically
                   * selects the board if only
                   * one selectable board exists.
                   */
                  if (
                    available.length ===
                      1
                  ) {
                    setSelectedBoardId(
                      available[0].id
                    );
                  } else {
                    setSelectedBoardId(
                      (
                        current
                      ) =>
                        available.some(
                          (
                            board
                          ) =>
                            board.id ===
                            current
                        )
                          ? current
                          : ""
                    );
                  }

                  setLoading(
                    false
                  );
                },
                (
                  boardError
                ) => {
                  console.error(
                    "Could not load boards:",
                    boardError
                  );

                  setError(
                    "Could not load available Smart Boards."
                  );

                  setLoading(
                    false
                  );
                }
              );
          } catch (
            loadError
          ) {
            console.error(
              "Could not load RFID linking page:",
              loadError
            );

            setError(
              loadError instanceof
              Error
                ? loadError.message
                : "Could not load RFID linking."
            );

            setLoading(
              false
            );
          }
        }
      );

    return () => {
      unsubscribeAuth();

      unsubscribeBoards?.();
    };
  }, [
    learnerId,
    navigate,
  ]);

  /*
   * =========================
   * LISTEN FOR RFID SCAN
   * =========================
   */

  useEffect(() => {
    const user =
      auth.currentUser;

    if (
      !user ||
      !selectedBoardId
    ) {
      setDetectedScan(
        null
      );

      return;
    }

    setDetectedScan(
      null
    );

    setError(
      ""
    );

    setSuccess(
      ""
    );

    const scansQuery =
      query(
        collection(
          db,
          "rfidScans"
        ),
        where(
          "teacherId",
          "==",
          user.uid
        )
      );

    const unsubscribe =
      onSnapshot(
        scansQuery,
        (
          snapshot
        ) => {
          const matches:
            RfidScan[] =
            snapshot.docs
              .map(
                (
                  scanDocument
                ) => {
                  const data =
                    scanDocument.data();

                  return {
                    id:
                      scanDocument.id,

                    teacherId:
                      data.teacherId ??
                      "",

                    boardId:
                      data.boardId ??
                      "",

                    uid:
                      data.uid ??
                      "",

                    readerId:
                      Number(
                        data.readerId ??
                          0
                      ),

                    consumed:
                      data.consumed ===
                      true,

                    scannedAt:
                      data.scannedAt ??
                      null,
                  };
                }
              )
              .filter(
                (
                  scan
                ) =>
                  scan.boardId ===
                    selectedBoardId &&
                  !scan.consumed &&
                  scan.readerId ===
                    5
              );

          /*
           * Android chooses the latest
           * matching scan.
           */

          matches.sort(
            (
              first,
              second
            ) =>
              (
                second.scannedAt
                  ?.seconds ??
                0
              ) -
              (
                first.scannedAt
                  ?.seconds ??
                0
              )
          );

          setDetectedScan(
            matches[0] ??
            null
          );
        },
        (
          scanError
        ) => {
          console.error(
            "Could not listen for RFID scans:",
            scanError
          );

          setError(
            "Could not listen for RFID card scans."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    selectedBoardId,
  ]);

  const selectedBoard =
    useMemo(
      () =>
        boards.find(
          (
            board
          ) =>
            board.id ===
            selectedBoardId
        ) ??
        null,
      [
        boards,
        selectedBoardId,
      ]
    );

  /*
   * =========================
   * LINK DETECTED CARD
   * =========================
   */

  const handleLink =
    async () => {
      const user =
        auth.currentUser;

      if (
        !user ||
        !learner ||
        !learnerId ||
        !selectedBoard ||
        !detectedScan
      ) {
        return;
      }

      try {
        setLinking(
          true
        );

        setError(
          ""
        );

        setSuccess(
          ""
        );

        const learnerReference =
          doc(
            db,
            "learners",
            learnerId
          );

        const boardReference =
          doc(
            db,
            "boards",
            selectedBoard.id
          );

        const scanReference =
          doc(
            db,
            "rfidScans",
            detectedScan.id
          );

        const registryReference =
          doc(
            db,
            "rfidCards",
            detectedScan.uid
          );

        await runTransaction(
          db,
          async (
            transaction
          ) => {
            /*
             * ALL READS FIRST
             */

            const currentLearner =
              await transaction.get(
                learnerReference
              );

            const currentBoard =
              await transaction.get(
                boardReference
              );

            const currentScan =
              await transaction.get(
                scanReference
              );

            const existingCard =
              await transaction.get(
                registryReference
              );

            /*
             * LEARNER VALIDATION
             */

            if (
              !currentLearner.exists() ||
              currentLearner.data()
                .teacherId !==
                user.uid
            ) {
              throw new Error(
                "Learner not found."
              );
            }

            /*
             * BOARD VALIDATION
             */

            if (
              !currentBoard.exists()
            ) {
              throw new Error(
                "Board is no longer available for card linking."
              );
            }

            const boardData =
              currentBoard.data();

            const transactionBoard:
              SmartBoard = {
                id:
                  currentBoard.id,

                teacherId:
                  boardData.teacherId ??
                  "",

                name:
                  boardData.name ??
                  "",

                room:
                  boardData.room ??
                  "",

                status:
                  boardData.status ??
                  "offline",

                currentSessionId:
                  boardData.currentSessionId ??
                  null,

                enabled:
                  boardData.enabled ??
                  true,

                linked:
                  boardData.linked ??
                  true,
              };

            if (
              transactionBoard.teacherId !==
                user.uid ||
              !boardSelectable(
                transactionBoard
              )
            ) {
              throw new Error(
                "Board is no longer available for card linking."
              );
            }

            /*
             * SCAN VALIDATION
             */

            if (
              !currentScan.exists()
            ) {
              throw new Error(
                "RFID scan is no longer available."
              );
            }

            const scanData =
              currentScan.data();

            if (
              scanData.teacherId !==
                user.uid ||
              scanData.boardId !==
                selectedBoard.id ||
              scanData.uid !==
                detectedScan.uid ||
              Number(
                scanData.readerId
              ) !==
                5 ||
              scanData.consumed ===
                true
            ) {
              throw new Error(
                "RFID scan is no longer available. Tap the card again."
              );
            }

            /*
             * CARD ALREADY LINKED
             */

            if (
              existingCard.exists() &&
              existingCard.data()
                .learnerId !==
                learnerId
            ) {
              throw new Error(
                "This card is already linked."
              );
            }

            const currentLearnerData =
              currentLearner.data();

            const name =
              [
                currentLearnerData.firstName ??
                  "",

                currentLearnerData.lastName ??
                  "",
              ]
                .filter(
                  (
                    part
                  ) =>
                    String(
                      part
                    ).trim()
                )
                .join(
                  " "
                );

            /*
             * SAME DOCUMENT FIELDS
             * USED BY ANDROID
             */

            transaction.set(
              registryReference,
              {
                uid:
                  detectedScan.uid,

                teacherId:
                  user.uid,

                learnerId,

                learnerName:
                  name,

                boardId:
                  selectedBoard.id,

                linkedAt:
                  serverTimestamp(),
              }
            );

            transaction.update(
              learnerReference,
              {
                rfidUid:
                  detectedScan.uid,

                updatedAt:
                  serverTimestamp(),
              }
            );

            transaction.update(
              scanReference,
              {
                consumed:
                  true,

                consumedAt:
                  serverTimestamp(),
              }
            );
          }
        );

        setSuccess(
          "RFID card linked successfully."
        );

        window.setTimeout(
          () => {
            navigate(
              `/teacher/learners/${learnerId}`
            );
          },
          700
        );
      } catch (
        linkError
      ) {
        console.error(
          "Could not link RFID card:",
          linkError
        );

        setError(
          linkError instanceof
          Error
            ? linkError.message
            : "Could not link RFID card."
        );
      } finally {
        setLinking(
          false
        );
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-rfid-heading">

        <button
          type="button"
          className="teacher-rfid-back"
          onClick={() =>
            navigate(
              `/teacher/learners/${learnerId}`
            )
          }
        >
          ← Learner Details
        </button>

        <span className="teacher-rfid-eyebrow">
          RFID CARD LINKING
        </span>

        <h2>
          Link RFID Card
        </h2>

        <p>
          Link a learner card using
          Reader 5 on an available
          Smart Board.
        </p>

      </div>

      {error && (
        <div
          className="teacher-rfid-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="teacher-rfid-success"
          role="status"
        >
          {success}
        </div>
      )}

      {loading && (
        <div className="teacher-rfid-loading">
          Loading RFID linking...
        </div>
      )}

      {!loading &&
        learner && (
          <div className="teacher-rfid-layout">

            {/* LEARNER */}

            <section className="teacher-rfid-card">

              <span className="teacher-rfid-section-label">
                LEARNER
              </span>

              <h3>
                {learnerName(
                  learner
                ) ||
                  "Learner"}
              </h3>

              <div className="teacher-rfid-current">

                <span>
                  CURRENT RFID STATUS
                </span>

                <strong
                  className={
                    learner.rfidUid
                      ? "linked"
                      : ""
                  }
                >
                  {learner.rfidUid
                    ? "Linked"
                    : "Not linked"}
                </strong>

                {learner.rfidUid && (
                  <small>
                    UID:{" "}
                    {
                      learner.rfidUid
                    }
                  </small>
                )}

              </div>

            </section>

            {/* BOARD */}

            <section className="teacher-rfid-card">

              <span className="teacher-rfid-section-label">
                SMART BOARD
              </span>

              <h3>
                Select Board
              </h3>

              {boards.length >
                0 ? (
                <select
                  value={
                    selectedBoardId
                  }
                  disabled={
                    linking
                  }
                  onChange={(
                    event
                  ) =>
                    setSelectedBoardId(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select available board
                  </option>

                  {boards.map(
                    (
                      board
                    ) => (
                      <option
                        key={
                          board.id
                        }
                        value={
                          board.id
                        }
                      >
                        {board.name ||
                          board.id}
                        {board.room
                          ? ` · ${board.room}`
                          : ""}
                      </option>
                    )
                  )}

                </select>
              ) : (
                <div className="teacher-rfid-no-board">
                  No available Smart Board
                  can currently be used for
                  RFID card linking.
                </div>
              )}

              {selectedBoard && (
                <div className="teacher-rfid-board-selected">

                  <span>
                    SELECTED BOARD
                  </span>

                  <strong>
                    {selectedBoard.name ||
                      selectedBoard.id}
                  </strong>

                  <small>
                    {
                      selectedBoard.id
                    }
                  </small>

                </div>
              )}

            </section>

            {/* SCAN */}

            <section className="teacher-rfid-card teacher-rfid-scan-card">

              <span className="teacher-rfid-section-label">
                CARD DETECTION
              </span>

              {!selectedBoard && (
                <>

                  <h3>
                    Select a board first
                  </h3>

                  <p>
                    Choose an available
                    Smart Board before
                    scanning the learner
                    card.
                  </p>

                </>
              )}

              {selectedBoard &&
                !detectedScan && (
                  <>

                    <div className="teacher-rfid-waiting-icon">
                      ◎
                    </div>

                    <h3>
                      Waiting for card
                    </h3>

                    <p>
                      Tap the learner's RFID
                      card on <strong>Reader 5</strong>{" "}
                      of{" "}
                      <strong>
                        {selectedBoard.name ||
                          selectedBoard.id}
                      </strong>
                      .
                    </p>

                  </>
                )}

              {selectedBoard &&
                detectedScan && (
                  <>

                    <div className="teacher-rfid-detected-icon">
                      ✓
                    </div>

                    <h3>
                      RFID Card Detected
                    </h3>

                    <div className="teacher-rfid-detected-uid">

                      <span>
                        CARD UID
                      </span>

                      <strong>
                        {
                          detectedScan.uid
                        }
                      </strong>

                    </div>

                    <button
                      type="button"
                      className="teacher-rfid-link-button"
                      disabled={
                        linking
                      }
                      onClick={() => {
                        void handleLink();
                      }}
                    >
                      {linking
                        ? "Linking Card..."
                        : "Link Detected Card"}
                    </button>

                  </>
                )}

            </section>

          </div>
        )}

    </TeacherLayout>
  );
}

export default TeacherLinkRfidPage;