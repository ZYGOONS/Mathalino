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
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherGuardianRequestsPage.css";

type RequestStatus =
  | "all"
  | "pending"
  | "approved"
  | "rejected";

interface GuardianRequestRow {
  id: string;
  guardianId: string;
  guardianLabel: string;

  learnerId: string;
  learnerName: string;

  relationship: string;
  status: string;

  requestedAt: string;
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

function getGuardianLabel(
  data: DocumentData
): string {
  if (
    typeof data.guardianName === "string" &&
    data.guardianName.trim()
  ) {
    return data.guardianName;
  }

  if (
    typeof data.guardianEmail === "string" &&
    data.guardianEmail.trim()
  ) {
    return data.guardianEmail;
  }

  if (
    typeof data.guardianId === "string" &&
    data.guardianId.trim()
  ) {
    return data.guardianId;
  }

  return "Guardian";
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

function TeacherGuardianRequestsPage() {
  const navigate = useNavigate();

  const [requests, setRequests] =
    useState<GuardianRequestRow[]>([]);

  const [activeStatus, setActiveStatus] =
    useState<RequestStatus>("pending");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [processingId, setProcessingId] =
    useState("");

  useEffect(() => {
    let active = true;

    let unsubscribeRequests:
      | (() => void)
      | undefined;

    const loadRequests = async (
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

        const learnersSnapshot =
          await getDocs(
            learnersQuery
          );

        const learnerNames =
          new Map<string, string>();

        learnersSnapshot.docs.forEach(
          (document) => {
            learnerNames.set(
              document.id,
              getDisplayName(
                document.data()
              )
            );
          }
        );

        const requestsQuery =
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
          );

        unsubscribeRequests =
          onSnapshot(
            requestsQuery,
            (snapshot) => {
              if (!active) {
                return;
              }

              const requestList =
                snapshot.docs.map(
                  (document) => {
                    const data =
                      document.data();

                    const learnerId =
                      data.learnerId ??
                      "";

                    return {
                      id:
                        document.id,

                      guardianId:
                        data.guardianId ??
                        "",

                      guardianLabel:
                        getGuardianLabel(
                          data
                        ),

                      learnerId,

                      learnerName:
                        learnerNames.get(
                          learnerId
                        ) ??
                        learnerId ??
                        "Unknown Learner",

                      relationship:
                        data.relationship ??
                        "—",

                      status:
                        data.status ??
                        "pending",

                      requestedAt:
                        formatTimestamp(
                          data.requestedAt ??
                            data.createdAt
                        ),
                    };
                  }
                );

              setRequests(
                requestList
              );

              setLoading(false);
            },
            (snapshotError) => {
              console.error(
                "Guardian requests listener error:",
                snapshotError
              );

              if (active) {
                setError(
                  "Unable to load guardian requests."
                );

                setLoading(false);
              }
            }
          );
      } catch (loadError) {
        console.error(
          "Unable to load guardian requests:",
          loadError
        );

        if (active) {
          setError(
            "Unable to load guardian requests."
          );

          setLoading(false);
        }
      }
    };

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            navigate("/");
            return;
          }

          void loadRequests(
            user
          );
        }
      );

    return () => {
      active = false;

      unsubscribeAuth();

      if (
        unsubscribeRequests
      ) {
        unsubscribeRequests();
      }
    };
  }, [navigate]);

  const filteredRequests =
    useMemo(() => {
      if (
        activeStatus ===
        "all"
      ) {
        return requests;
      }

      return requests.filter(
        (request) =>
          request.status
            .toLowerCase() ===
          activeStatus
      );
    }, [
      requests,
      activeStatus,
    ]);

  const pendingCount =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            request.status
              .toLowerCase() ===
            "pending"
        ).length,
      [requests]
    );

  const handleApprove =
    async (
      request: GuardianRequestRow
    ) => {
      const teacher =
        auth.currentUser;

      if (!teacher) {
        navigate("/");
        return;
      }

      if (
        !request.guardianId ||
        !request.learnerId
      ) {
        setError(
          "This guardian request is missing required information."
        );

        return;
      }

      try {
        setProcessingId(
          request.id
        );

        setError("");

        const requestReference =
          doc(
            db,
            "guardianRequests",
            request.id
          );

        const linkId =
          `${request.guardianId}_${request.learnerId}`;

        const linkReference =
          doc(
            db,
            "guardianLinks",
            linkId
          );

        const batch =
          writeBatch(db);

        batch.set(
          linkReference,
          {
            guardianId:
              request.guardianId,

            learnerId:
              request.learnerId,

            teacherId:
              teacher.uid,

            status:
              "active",

            createdAt:
              serverTimestamp(),
          }
        );

        batch.update(
          requestReference,
          {
            status:
              "approved",

            updatedAt:
              serverTimestamp(),
          }
        );

        await batch.commit();
      } catch (approveError) {
        console.error(
          "Unable to approve request:",
          approveError
        );

        setError(
          "Unable to approve this guardian request."
        );
      } finally {
        setProcessingId("");
      }
    };

  const handleReject =
    async (
      request: GuardianRequestRow
    ) => {
      try {
        setProcessingId(
          request.id
        );

        setError("");

        await updateDoc(
          doc(
            db,
            "guardianRequests",
            request.id
          ),
          {
            status:
              "rejected",

            updatedAt:
              serverTimestamp(),
          }
        );
      } catch (rejectError) {
        console.error(
          "Unable to reject request:",
          rejectError
        );

        setError(
          "Unable to reject this guardian request."
        );
      } finally {
        setProcessingId("");
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-requests-heading">

        <div>

          <span className="teacher-requests-eyebrow">
            GUARDIAN ACCESS
          </span>

          <h2>
            Guardian Requests
          </h2>

          <p>
            Review guardian requests
            associated with your learners.
          </p>

        </div>

        <div className="teacher-requests-total">

          <span>
            PENDING REQUESTS
          </span>

          <strong>
            {loading
              ? "—"
              : pendingCount}
          </strong>

        </div>

      </div>

      <section className="teacher-requests-card">

        <div className="teacher-requests-toolbar">

          <div>

            <h3>
              Access Requests
            </h3>

            <p>
              Approve or reject guardian
              access to your learners.
            </p>

          </div>

          <div className="teacher-request-tabs">

            {(
              [
                "pending",
                "approved",
                "rejected",
                "all",
              ] as RequestStatus[]
            ).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  className={
                    activeStatus ===
                    status
                      ? "teacher-request-tab active"
                      : "teacher-request-tab"
                  }
                  onClick={() =>
                    setActiveStatus(
                      status
                    )
                  }
                >
                  {formatStatus(
                    status
                  )}
                </button>
              )
            )}

          </div>

        </div>

        {error && (
          <div
            className="teacher-requests-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {loading && (
          <div className="teacher-requests-message">
            Loading guardian requests...
          </div>
        )}

        {!loading &&
          filteredRequests.length ===
            0 && (
            <div className="teacher-requests-message">
              No{" "}
              {activeStatus ===
              "all"
                ? ""
                : `${activeStatus} `}
              guardian requests found.
            </div>
          )}

        {!loading &&
          filteredRequests.length >
            0 && (
            <div className="teacher-requests-table-wrapper">

              <table className="teacher-requests-table">

                <thead>
                  <tr>
                    <th>
                      Guardian
                    </th>

                    <th>
                      Learner
                    </th>

                    <th>
                      Relationship
                    </th>

                    <th>
                      Requested
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {filteredRequests.map(
                    (request) => (
                      <tr
                        key={
                          request.id
                        }
                      >

                        <td className="teacher-request-guardian">
                          {
                            request.guardianLabel
                          }
                        </td>

                        <td>
                          {
                            request.learnerName
                          }
                        </td>

                        <td>
                          {
                            request.relationship
                          }
                        </td>

                        <td>
                          {
                            request.requestedAt
                          }
                        </td>

                        <td>
                          <span
                            className={`teacher-request-status ${request.status.toLowerCase()}`}
                          >
                            {formatStatus(
                              request.status
                            )}
                          </span>
                        </td>

                        <td>

                          {request.status
                            .toLowerCase() ===
                          "pending" ? (
                            <div className="teacher-request-actions">

                              <button
                                type="button"
                                className="teacher-request-approve"
                                disabled={
                                  processingId ===
                                  request.id
                                }
                                onClick={() => {
                                  void handleApprove(
                                    request
                                  );
                                }}
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                className="teacher-request-reject"
                                disabled={
                                  processingId ===
                                  request.id
                                }
                                onClick={() => {
                                  void handleReject(
                                    request
                                  );
                                }}
                              >
                                Reject
                              </button>

                            </div>
                          ) : (
                            <span className="teacher-request-complete">
                              Completed
                            </span>
                          )}

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

export default TeacherGuardianRequestsPage;