import {
  useEffect,
  useState,
} from "react";

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

interface FirestoreTimestamp {
  toMillis: () => number;
}

export interface BoardTelemetry {
  boardId: string;
  teacherId: string;
  sessionId: string;
  displayText: string;
  lastSeenAt: FirestoreTimestamp | null;
}

export type BoardConnectionStatus =
  | "Connected"
  | "Connection unknown"
  | "No update for over 20 seconds";

export function getBoardConnectionStatus(
  telemetry: BoardTelemetry | undefined,
  nowMs: number
): BoardConnectionStatus {
  if (!telemetry?.lastSeenAt) {
    return "Connection unknown";
  }

  const lastSeenMs =
    telemetry.lastSeenAt.toMillis();

  const age =
    nowMs - lastSeenMs;

  // Same rule as Android:
  // heartbeat must be 0–20 seconds old.
  if (
    age >= 0 &&
    age <= 20_000
  ) {
    return "Connected";
  }

  return "No update for over 20 seconds";
}

export function getBoardDisplayText(
  telemetry: BoardTelemetry | undefined,
  currentSessionId: string | null
): string {
  if (!telemetry) {
    return "";
  }

  /*
   * Same behavior as Android:
   *
   * If a session is active, only display
   * telemetry belonging to that session.
   *
   * When the board is idle, its latest
   * display can still be shown.
   */
  if (
    currentSessionId &&
    telemetry.sessionId !== currentSessionId
  ) {
    return "";
  }

  return telemetry.displayText
    .replaceAll("Â·", "·")
    .replaceAll("Ã‚", "")
    .trim();
}

export function useBoardTelemetry() {
  const [
    telemetryByBoardId,
    setTelemetryByBoardId,
  ] = useState<
    Record<
      string,
      BoardTelemetry
    >
  >({});

  const [
    nowMs,
    setNowMs,
  ] = useState(
    Date.now()
  );

  const [
    telemetryError,
    setTelemetryError,
  ] = useState("");

  /*
   * Android refreshes the connection
   * interpretation every 5 seconds.
   *
   * We do the same even when Firestore
   * itself has not emitted a new snapshot.
   */
  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNowMs(
            Date.now()
          );
        },
        5_000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, []);

  useEffect(() => {
    let unsubscribeTelemetry:
      | (() => void)
      | undefined;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        (user) => {
          if (
            unsubscribeTelemetry
          ) {
            unsubscribeTelemetry();
            unsubscribeTelemetry =
              undefined;
          }

          setTelemetryByBoardId(
            {}
          );

          setTelemetryError(
            ""
          );

          if (!user) {
            return;
          }

          const telemetryQuery =
            query(
              collection(
                db,
                "boardTelemetry"
              ),
              where(
                "teacherId",
                "==",
                user.uid
              )
            );

          unsubscribeTelemetry =
            onSnapshot(
              telemetryQuery,
              (
                snapshot
              ) => {
                const nextTelemetry:
                  Record<
                    string,
                    BoardTelemetry
                  > = {};

                snapshot.docs.forEach(
                  (
                    telemetryDocument
                  ) => {
                    const data =
                      telemetryDocument.data();

                    const boardId =
                      data.boardId ??
                      telemetryDocument.id;

                    nextTelemetry[
                      boardId
                    ] = {
                      boardId,

                      teacherId:
                        data.teacherId ??
                        "",

                      sessionId:
                        data.sessionId ??
                        "",

                      displayText:
                        data.displayText ??
                        "",

                      lastSeenAt:
                        data.lastSeenAt ??
                        null,
                    };
                  }
                );

                setTelemetryByBoardId(
                  nextTelemetry
                );

                setTelemetryError(
                  ""
                );

                setNowMs(
                  Date.now()
                );
              },
              (
                error
              ) => {
                console.error(
                  "Could not load board telemetry:",
                  error
                );

                setTelemetryError(
                  "Could not load Smart Board connection status."
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      if (
        unsubscribeTelemetry
      ) {
        unsubscribeTelemetry();
      }
    };
  }, []);

  return {
    telemetryByBoardId,
    nowMs,
    telemetryError,
  };
}