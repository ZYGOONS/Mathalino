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
  where,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherRecommendationHistoryPage.css";

interface Learner {
  id: string;

  firstName: string;
  lastName: string;

  grade: string;
  section: string;
}

interface RecommendationHistoryRecord {
  id: string;

  teacherId: string;
  learnerId: string;

  sourceAssignmentId: string;

  topic: string;

  masteryPercent: number | null;
  masteryLevel: string;

  currentDifficulty: string;

  currentMinNumber: number;
  currentMaxNumber: number;

  recommendedDifficulty: string;

  recommendedMinNumber: number;
  recommendedMaxNumber: number;

  questionCount: number;

  reason: string;
  evidence: string;

  status: string;

  activityId: string;
  assignmentId: string;

  createdAt:
    | Timestamp
    | null;

  reviewedAt:
    | Timestamp
    | null;
}

interface Assignment {
  id: string;

  teacherId: string;
  learnerId: string;

  activityId: string;
  activityTitle: string;

  status: string;

  recommendationHistoryId: string;

  assignedAt:
    | Timestamp
    | null;

  completedAt:
    | Timestamp
    | null;
}

/*
 * =========================
 * HELPERS
 * =========================
 */

function fullName(
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
    .join(" ");
}

function capitalize(
  value: string
): string {
  if (!value) {
    return "—";
  }

  return (
    value
      .charAt(0)
      .toUpperCase() +
    value.slice(1)
  );
}

function statusLabel(
  status: string
): string {
  switch (
    status
      .trim()
      .toLowerCase()
  ) {
    case "approved":
      return "Approved";

    case "dismissed":
      return "Dismissed";

    case "adjusted":
      return "Adjusted";

    case "pending":
      return "Pending";

    case "assigned":
      return "Assigned";

    case "in_progress":
      return "In Progress";

    case "completed":
      return "Completed";

    case "canceled":
      return "Canceled";

    default:
      return status
        .replace(
          /_/g,
          " "
        );
  }
}

function formatDateTime(
  timestamp:
    Timestamp | null
): string {
  if (!timestamp) {
    return "Not recorded";
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

function friendlyText(
  value: string
): string {
  if (!value) {
    return "No additional information was recorded.";
  }

  return value
    .replace(
      /More evidence is needed:/gi,
      "More practice is needed:"
    )
    .replace(
      /Latest source session:/gi,
      "Last activity:"
    )
    .replace(
      /Latest-session first-attempt accuracy/gi,
      "Correct on the first try in the last activity"
    )
    .replace(
      /multiple attempts/gi,
      "more than one try"
    )
    .replace(
      /first attempt/gi,
      "first try"
    );
}

function historyStage(
  recommendationStatus: string,
  assignmentStatus:
    string | null
): string {
  if (
    recommendationStatus ===
    "dismissed"
  ) {
    return "Pending → Dismissed";
  }

  if (
    assignmentStatus ===
    "completed"
  ) {
    return "Pending → Approved → Assigned → Completed";
  }

  if (
    assignmentStatus ===
    "in_progress"
  ) {
    return "Pending → Approved → Assigned → In Progress";
  }

  if (
    assignmentStatus ===
    "assigned"
  ) {
    return "Pending → Approved → Assigned";
  }

  if (
    assignmentStatus ===
    "canceled"
  ) {
    return "Pending → Approved → Assigned → Canceled";
  }

  if (
    recommendationStatus ===
      "approved" ||
    recommendationStatus ===
      "adjusted"
  ) {
    return "Pending → Approved";
  }

  return "Pending";
}

/*
 * =========================
 * PAGE
 * =========================
 */

function TeacherRecommendationHistoryPage() {
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
    history,
    setHistory,
  ] =
    useState<
      RecommendationHistoryRecord[]
    >([]);

  const [
    assignments,
    setAssignments,
  ] =
    useState<
      Assignment[]
    >([]);

  const [
    historyLoaded,
    setHistoryLoaded,
  ] =
    useState(false);

  const [
    assignmentsLoaded,
    setAssignmentsLoaded,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * =========================
   * LOAD DATA
   * =========================
   */

  useEffect(() => {
    if (!learnerId) {
      navigate(
        "/teacher/learners"
      );

      return;
    }

    let unsubscribeHistory:
      | (() => void)
      | undefined;

    let unsubscribeAssignments:
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
            const learnerReference =
              doc(
                db,
                "learners",
                learnerId
              );

            const learnerSnapshot =
              await getDoc(
                learnerReference
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

              firstName:
                learnerData.firstName ??
                "",

              lastName:
                learnerData.lastName ??
                "",

              grade:
                learnerData.grade ??
                "",

              section:
                learnerData.section ??
                "",
            });

            /*
             * Recommendation History
             */

            unsubscribeHistory =
              onSnapshot(
                collection(
                  db,
                  "recommendations",
                  learnerId,
                  "history"
                ),
                (
                  snapshot
                ) => {
                  const records =
                    snapshot.docs
                      .map(
                        (
                          historyDocument
                        ): RecommendationHistoryRecord => {
                          const data =
                            historyDocument.data();

                          return {
                            id:
                              historyDocument.id,

                            teacherId:
                              data.teacherId ??
                              "",

                            learnerId:
                              data.learnerId ??
                              "",

                            sourceAssignmentId:
                              data.sourceAssignmentId ??
                              historyDocument.id,

                            topic:
                              data.topic ??
                              "",

                            masteryPercent:
                              data.masteryPercent ===
                                null ||
                              data.masteryPercent ===
                                undefined
                                ? null
                                : Number(
                                    data.masteryPercent
                                  ),

                            masteryLevel:
                              data.masteryLevel ??
                              "",

                            currentDifficulty:
                              data.currentDifficulty ??
                              "easy",

                            currentMinNumber:
                              Number(
                                data.currentMinNumber ??
                                  0
                              ),

                            currentMaxNumber:
                              Number(
                                data.currentMaxNumber ??
                                  10
                              ),

                            recommendedDifficulty:
                              data.recommendedDifficulty ??
                              "easy",

                            recommendedMinNumber:
                              Number(
                                data.recommendedMinNumber ??
                                  0
                              ),

                            recommendedMaxNumber:
                              Number(
                                data.recommendedMaxNumber ??
                                  10
                              ),

                            questionCount:
                              Number(
                                data.questionCount ??
                                  0
                              ),

                            reason:
                              data.reason ??
                              "",

                            evidence:
                              data.evidence ??
                              "",

                            status:
                              data.status ??
                              "pending",

                            activityId:
                              data.activityId ??
                              "",

                            assignmentId:
                              data.assignmentId ??
                              "",

                            createdAt:
                              data.createdAt ??
                              null,

                            reviewedAt:
                              data.reviewedAt ??
                              null,
                          };
                        }
                      )
                      .filter(
                        (
                          record
                        ) =>
                          record.teacherId ===
                            user.uid &&
                          record.learnerId ===
                            learnerId
                      )
                      .sort(
                        (
                          first,
                          second
                        ) =>
                          (
                            second.reviewedAt
                              ?.seconds ??
                            second.createdAt
                              ?.seconds ??
                            0
                          ) -
                          (
                            first.reviewedAt
                              ?.seconds ??
                            first.createdAt
                              ?.seconds ??
                            0
                          )
                      );

                  setHistory(
                    records
                  );

                  setHistoryLoaded(
                    true
                  );
                },
                (
                  historyError
                ) => {
                  console.error(
                    "Could not load recommendation history:",
                    historyError
                  );

                  setError(
                    "Could not load recommendation history."
                  );

                  setHistoryLoaded(
                    true
                  );
                }
              );

            /*
             * Learner Assignments
             */

            const assignmentsQuery =
              query(
                collection(
                  db,
                  "assignments"
                ),

                where(
                  "teacherId",
                  "==",
                  user.uid
                ),

                where(
                  "learnerId",
                  "==",
                  learnerId
                )
              );

            unsubscribeAssignments =
              onSnapshot(
                assignmentsQuery,
                (
                  snapshot
                ) => {
                  const list =
                    snapshot.docs.map(
                      (
                        assignmentDocument
                      ): Assignment => {
                        const data =
                          assignmentDocument.data();

                        return {
                          id:
                            assignmentDocument.id,

                          teacherId:
                            data.teacherId ??
                            "",

                          learnerId:
                            data.learnerId ??
                            "",

                          activityId:
                            data.activityId ??
                            "",

                          activityTitle:
                            data.activityTitle ??
                            "",

                          status:
                            data.status ??
                            "",

                          recommendationHistoryId:
                            data.recommendationHistoryId ??
                            "",

                          assignedAt:
                            data.assignedAt ??
                            null,

                          completedAt:
                            data.completedAt ??
                            null,
                        };
                      }
                    );

                  setAssignments(
                    list
                  );

                  setAssignmentsLoaded(
                    true
                  );
                },
                (
                  assignmentError
                ) => {
                  console.error(
                    "Could not load linked assignments:",
                    assignmentError
                  );

                  setError(
                    "Recommendation history loaded, but linked assignments could not be loaded."
                  );

                  setAssignmentsLoaded(
                    true
                  );
                }
              );
          } catch (
            loadError
          ) {
            console.error(
              "Could not load recommendation history:",
              loadError
            );

            setError(
              loadError instanceof
              Error
                ? loadError.message
                : "Could not load recommendation history."
            );

            setHistoryLoaded(
              true
            );

            setAssignmentsLoaded(
              true
            );
          }
        }
      );

    return () => {
      unsubscribeAuth();

      unsubscribeHistory?.();

      unsubscribeAssignments?.();
    };
  }, [
    learnerId,
    navigate,
  ]);

  /*
   * =========================
   * ASSIGNMENT LOOKUP
   * =========================
   */

  const assignmentsById =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            Assignment
          >();

        assignments.forEach(
          (
            assignment
          ) => {
            map.set(
              assignment.id,
              assignment
            );
          }
        );

        return map;
      },
      [
        assignments,
      ]
    );

  const findLinkedAssignment =
    (
      record:
        RecommendationHistoryRecord
    ):
      | Assignment
      | null => {
      if (
        record.assignmentId
      ) {
        const direct =
          assignmentsById.get(
            record.assignmentId
          );

        if (direct) {
          return direct;
        }
      }

      return (
        assignments.find(
          (
            assignment
          ) =>
            assignment.recommendationHistoryId ===
            record.sourceAssignmentId
        ) ??
        null
      );
    };

  const loading =
    !historyLoaded ||
    !assignmentsLoaded;

  /*
   * =========================
   * UI
   * =========================
   */

  return (
    <TeacherLayout>

      <div className="teacher-recommendation-history-heading">

        <button
          type="button"
          className="teacher-recommendation-history-back"
          onClick={() =>
            navigate(
              `/teacher/learners/${learnerId}/performance`
            )
          }
        >
          ← Learner Performance
        </button>

        <span className="teacher-recommendation-history-eyebrow">
          LEARNER PERFORMANCE
        </span>

        <h2>
          Recommendation History
        </h2>

        {learner && (
          <p>
            {fullName(
              learner
            )}

            {learner.grade && (
              <>
                {" · "}
                {learner.grade}
              </>
            )}

            {learner.section && (
              <>
                {" · "}
                Section{" "}
                {
                  learner.section
                }
              </>
            )}
          </p>
        )}

      </div>

      {error && (
        <div
          className="teacher-recommendation-history-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="teacher-recommendation-history-loading">
          Loading recommendation history...
        </div>
      )}

      {!loading &&
        history.length ===
          0 && (
          <section className="teacher-recommendation-history-empty">

            <h3>
              No reviewed recommendations yet
            </h3>

            <p>
              Recommendations will appear
              here after the teacher
              approves or dismisses them.
            </p>

          </section>
        )}

      {!loading &&
        history.length >
          0 && (
          <div className="teacher-recommendation-history-list">

            {history.map(
              (
                record
              ) => {
                const assignment =
                  findLinkedAssignment(
                    record
                  );

                const assignmentStatus =
                  assignment?.status ??
                  null;

                return (
                  <article
                    key={
                      record.id
                    }
                    className="teacher-recommendation-history-card"
                  >

                    {/* TOP */}

                    <div className="teacher-recommendation-history-card-top">

                      <div>

                        <span className="teacher-recommendation-history-topic">
                          {
                            record.topic
                          }
                        </span>

                        <h3>
                          {historyStage(
                            record.status,
                            assignmentStatus
                          )}
                        </h3>

                      </div>

                      <span
                        className={`teacher-recommendation-history-status ${record.status}`}
                      >
                        {statusLabel(
                          record.status
                        )}
                      </span>

                    </div>

                    {/* DATES */}

                    <div className="teacher-recommendation-history-dates">

                      <div>

                        <span>
                          CREATED
                        </span>

                        <strong>
                          {formatDateTime(
                            record.createdAt
                          )}
                        </strong>

                      </div>

                      <div>

                        <span>
                          REVIEWED
                        </span>

                        <strong>
                          {formatDateTime(
                            record.reviewedAt
                          )}
                        </strong>

                      </div>

                    </div>

                    {/* MASTERY */}

                    <section className="teacher-recommendation-history-original">

                      <span>
                        PERFORMANCE AT TIME OF RECOMMENDATION
                      </span>

                      <strong>
                        {record.masteryPercent ===
                        null
                          ? "Mastery unavailable"
                          : `${record.masteryPercent}% mastery`}

                        {record.masteryLevel
                          ? ` · ${record.masteryLevel}`
                          : ""}
                      </strong>

                    </section>

                    {/* CURRENT SETTINGS */}

                    <section className="teacher-recommendation-history-original">

                      <span>
                        CURRENT SETTINGS
                      </span>

                      <strong>
                        {capitalize(
                          record.currentDifficulty
                        )}
                        {" · "}
                        {
                          record.currentMinNumber
                        }
                        –
                        {
                          record.currentMaxNumber
                        }
                      </strong>

                    </section>

                    {/* RECOMMENDED */}

                    <section className="teacher-recommendation-history-recommendation">

                      <span>
                        RECOMMENDED SETTINGS
                      </span>

                      <strong>
                        {capitalize(
                          record.recommendedDifficulty
                        )}
                        {" · "}
                        {
                          record.recommendedMinNumber
                        }
                        –
                        {
                          record.recommendedMaxNumber
                        }
                        {" · "}
                        {
                          record.questionCount
                        }{" "}
                        questions
                      </strong>

                    </section>

                    {/* EVIDENCE / REASON */}

                    <div className="teacher-recommendation-history-content">

                      <section>

                        <span>
                          ACTIVITY RESULTS
                        </span>

                        <p>
                          {friendlyText(
                            record.evidence
                          )}
                        </p>

                      </section>

                      <section>

                        <span>
                          RECOMMENDED NEXT STEP
                        </span>

                        <p>
                          {friendlyText(
                            record.reason
                          )}
                        </p>

                      </section>

                    </div>

                    {/* ASSIGNMENT */}

                    <div className="teacher-recommendation-history-linked">

                      <span className="teacher-recommendation-history-linked-heading">
                        LINKED ASSIGNMENT
                      </span>

                      {!assignment && (
                        <div className="teacher-recommendation-history-no-assignment">
                          {record.status ===
                          "dismissed"
                            ? "This recommendation was dismissed, so no activity was assigned."
                            : "No linked assignment was found."}
                        </div>
                      )}

                      {assignment && (
                        <div className="teacher-recommendation-history-assignment">

                          <div className="teacher-recommendation-history-assignment-info">

                            <strong>
                              {assignment.activityTitle ||
                                "Recommended activity"}
                            </strong>

                            <span>
                              {statusLabel(
                                assignment.status
                              )}
                            </span>

                            <p>
                              Assigned:{" "}
                              {assignment.assignedAt
                                ? formatDateTime(
                                    assignment.assignedAt
                                  )
                                : "Not recorded"}
                            </p>

                            <p>
                              Completed:{" "}
                              {assignment.completedAt
                                ? formatDateTime(
                                    assignment.completedAt
                                  )
                                : "Not completed"}
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                assignment.status ===
                                "completed"
                              ) {
                                navigate(
                                  `/teacher/learners/${learnerId}/results?assignmentId=${encodeURIComponent(
                                    assignment.id
                                  )}`
                                );

                                return;
                              }

                              navigate(
                                `/teacher/learners/${learnerId}/assignments`
                              );
                            }}
                          >
                            {assignment.status ===
                            "completed"
                              ? "View session results"
                              : "View assignment"}
                          </button>

                        </div>
                      )}

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

export default TeacherRecommendationHistoryPage;