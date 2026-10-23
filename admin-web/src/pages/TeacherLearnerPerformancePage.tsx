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

import {
  reviewRecommendation,
  type AdaptiveRecommendation,
  type RecommendationQuestion,
} from "../services/recommendationReview";

import "./TeacherLearnerPerformancePage.css";

interface Learner {
  id: string;

  firstName: string;
  lastName: string;

  grade: string;
  section: string;
}

interface Assignment {
  id: string;

  teacherId: string;
  learnerId: string;

  activityTitle: string;

  topic: string;

  status: string;

  score:
    | number
    | null;

  totalQuestions:
    | number
    | null;

  masteryPercent:
    | number
    | null;

  completedAt:
    | Timestamp
    | null;
}

interface TopicPerformance {
  topic: string;

  percentage:
    | number
    | null;

  completedCount: number;

  level: string;
}

const SUPPORTED_TOPICS = [
  "Number Sense",
  "Addition",
  "Subtraction",
];

function masteryLevel(
  percentage: number
): string {
  if (
    percentage <
    60
  ) {
    return "Low";
  }

  if (
    percentage <
    80
  ) {
    return "Developing";
  }

  return "High";
}

function roundedAverage(
  values: number[]
):
  | number
  | null {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  return Math.round(
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
      values.length
  );
}

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

function formatDate(
  timestamp:
    Timestamp | null
): string {
  if (!timestamp) {
    return "Date unavailable";
  }

  return timestamp
    .toDate()
    .toLocaleDateString(
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

function capitalized(
  value: string
): string {
  if (!value) {
    return value;
  }

  return (
    value.charAt(
      0
    ).toUpperCase() +
    value.slice(
      1
    )
  );
}

function recommendationStatus(
  status: string
): string {
  switch (status) {
    case "approved":
      return "APPROVED";

    case "adjusted":
      return "ADJUSTED AND APPROVED";

    case "dismissed":
      return "DISMISSED";

    default:
      return "PENDING REVIEW";
  }
}

function recommendationFromData(
  id: string,
  data:
    Record<
      string,
      unknown
    >
): AdaptiveRecommendation {
  return {
    id,

    teacherId:
      String(
        data.teacherId ??
          ""
      ),

    learnerId:
      String(
        data.learnerId ??
          ""
      ),

    sourceAssignmentId:
      String(
        data.sourceAssignmentId ??
          ""
      ),

    topic:
      String(
        data.topic ??
          ""
      ),

    masteryPercent:
      Number(
        data.masteryPercent ??
          0
      ),

    masteryLevel:
      String(
        data.masteryLevel ??
          ""
      ),

    currentDifficulty:
      String(
        data.currentDifficulty ??
          "easy"
      ),

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
      String(
        data.recommendedDifficulty ??
          "easy"
      ),

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

    previewQuestions:
      Array.isArray(
        data.previewQuestions
      )
        ? data.previewQuestions as
            RecommendationQuestion[]
        : [],

    activityId:
      String(
        data.activityId ??
          ""
      ),

    assignmentId:
      String(
        data.assignmentId ??
          ""
      ),

    reason:
      String(
        data.reason ??
          ""
      ),

    evidence:
      String(
        data.evidence ??
          ""
      ),

    status:
      String(
        data.status ??
          "pending"
      ),
  };
}

function TeacherLearnerPerformancePage() {
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
    assignments,
    setAssignments,
  ] =
    useState<
      Assignment[]
    >([]);

  const [
    recommendations,
    setRecommendations,
  ] =
    useState<
      AdaptiveRecommendation[]
    >([]);

  const [
    selectedTopic,
    setSelectedTopic,
  ] =
    useState(
      "Addition"
    );

  const [
    previewOpen,
    setPreviewOpen,
  ] =
    useState(false);

  const [
    whyOpen,
    setWhyOpen,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    reviewing,
    setReviewing,
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

    let unsubscribeAssignments:
      | (() => void)
      | undefined;

    let unsubscribeRecommendations:
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

                          activityTitle:
                            data.activityTitle ??
                            "",

                          topic:
                            data.topic ??
                            "",

                          status:
                            data.status ??
                            "",

                          score:
                            data.score ===
                              null ||
                            data.score ===
                              undefined
                              ? null
                              : Number(
                                  data.score
                                ),

                          totalQuestions:
                            data.totalQuestions ===
                              null ||
                            data.totalQuestions ===
                              undefined
                              ? null
                              : Number(
                                  data.totalQuestions
                                ),

                          masteryPercent:
                            data.masteryPercent ===
                              null ||
                            data.masteryPercent ===
                              undefined
                              ? null
                              : Number(
                                  data.masteryPercent
                                ),

                          completedAt:
                            data.completedAt ??
                            null,
                        };
                      }
                    );

                  setAssignments(
                    list
                  );

                  setLoading(
                    false
                  );
                },
                (
                  assignmentError
                ) => {
                  console.error(
                    "Could not load learner performance:",
                    assignmentError
                  );

                  setError(
                    "Could not load learner performance."
                  );

                  setLoading(
                    false
                  );
                }
              );

            unsubscribeRecommendations =
              onSnapshot(
                collection(
                  db,
                  "recommendations",
                  learnerId,
                  "topics"
                ),
                (
                  snapshot
                ) => {
                  const list =
                    snapshot.docs
                      .map(
                        (
                          recommendationDocument
                        ) =>
                          recommendationFromData(
                            recommendationDocument.id,
                            recommendationDocument.data()
                          )
                      )
                      .filter(
                        (
                          recommendation
                        ) =>
                          recommendation.teacherId ===
                            user.uid &&
                          recommendation.learnerId ===
                            learnerId
                      );

                  setRecommendations(
                    list
                  );
                },
                (
                  recommendationError
                ) => {
                  console.error(
                    "Could not load recommendations:",
                    recommendationError
                  );

                  setError(
                    "Completed results are available, but recommendations could not be loaded."
                  );
                }
              );
          } catch (
            loadError
          ) {
            console.error(
              "Could not load learner performance:",
              loadError
            );

            setError(
              loadError instanceof
              Error
                ? loadError.message
                : "Could not load learner performance."
            );

            setLoading(
              false
            );
          }
        }
      );

    return () => {
      unsubscribeAuth();

      unsubscribeAssignments?.();

      unsubscribeRecommendations?.();
    };
  }, [
    learnerId,
    navigate,
  ]);

  useEffect(() => {
    setPreviewOpen(
      false
    );

    setWhyOpen(
      false
    );

    setError(
      ""
    );

    setSuccess(
      ""
    );
  }, [
    selectedTopic,
  ]);

  /*
   * =========================
   * PERFORMANCE
   * =========================
   */

  const completedAssignments =
    useMemo(
      () =>
        assignments
          .filter(
            (
              assignment
            ) =>
              assignment.status
                .toLowerCase() ===
                "completed" &&
              assignment.masteryPercent !==
                null
          )
          .sort(
            (
              first,
              second
            ) =>
              (
                second.completedAt
                  ?.seconds ??
                0
              ) -
              (
                first.completedAt
                  ?.seconds ??
                0
              )
          ),
      [
        assignments,
      ]
    );

  const topics =
    useMemo<
      TopicPerformance[]
    >(
      () =>
        SUPPORTED_TOPICS.map(
          (
            topic
          ) => {
            const records =
              completedAssignments.filter(
                (
                  assignment
                ) =>
                  assignment.topic.toLowerCase() ===
                  topic.toLowerCase()
              );

            const percentages =
              records
                .map(
                  (
                    assignment
                  ) =>
                    assignment.masteryPercent
                )
                .filter(
                  (
                    value
                  ): value is number =>
                    value !==
                    null
                );

            const percentage =
              roundedAverage(
                percentages
              );

            return {
              topic,

              percentage,

              completedCount:
                records.length,

              level:
                percentage ===
                null
                  ? "Not started"
                  : masteryLevel(
                      percentage
                    ),
            };
          }
        ),
      [
        completedAssignments,
      ]
    );

  const attemptedTopicPercentages =
    topics
      .map(
        (
          topic
        ) =>
          topic.percentage
      )
      .filter(
        (
          percentage
        ): percentage is number =>
          percentage !==
          null
      );

  const overallPercentage =
    roundedAverage(
      attemptedTopicPercentages
    );

  const overallLevel =
    overallPercentage ===
    null
      ? "Not started"
      : masteryLevel(
          overallPercentage
        );

  const attemptedTopics =
    attemptedTopicPercentages.length;

  const currentRecommendation =
    recommendations.find(
      (
        recommendation
      ) =>
        recommendation.topic ===
        selectedTopic
    ) ??
    null;

  const pendingRecommendations =
    recommendations.filter(
      (
        recommendation
      ) =>
        recommendation.status ===
        "pending"
    ).length;

  /*
   * =========================
   * REVIEW
   * =========================
   */

  const handleReview =
    async (
      decision:
        "approved" |
        "dismissed"
    ) => {
      if (
        !currentRecommendation
      ) {
        return;
      }

      if (
        decision ===
          "approved" &&
        !previewOpen
      ) {
        setError(
          "Preview the recommendation questions before approving."
        );

        return;
      }

      try {
        setReviewing(
          true
        );

        setError(
          ""
        );

        setSuccess(
          ""
        );

        await reviewRecommendation(
          currentRecommendation,
          decision
        );

        if (
          decision ===
          "approved"
        ) {
          setSuccess(
            "Recommendation approved. The activity is now assigned to this learner."
          );
        } else {
          setSuccess(
            "Recommendation dismissed."
          );
        }
      } catch (
        reviewError
      ) {
        console.error(
          "Could not review recommendation:",
          reviewError
        );

        setError(
          reviewError instanceof
          Error
            ? reviewError.message
            : "Could not update recommendation."
        );
      } finally {
        setReviewing(
          false
        );
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-performance-heading">

        <button
          type="button"
          className="teacher-performance-back"
          onClick={() =>
            navigate(
              `/teacher/learners/${learnerId}`
            )
          }
        >
          ← Learner Details
        </button>

        <span className="teacher-performance-eyebrow">
          LEARNER PERFORMANCE
        </span>

        <h2>
          {learner
            ? fullName(
                learner
              )
            : "Performance"}
        </h2>

        {learner && (
          <p>
            Grade{" "}
            {learner.grade ||
              "—"}{" "}
            · Section{" "}
            {learner.section ||
              "—"}
          </p>
        )}

      </div>

      {error && (
        <div
          className="teacher-performance-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="teacher-performance-success"
          role="status"
        >
          {success}
        </div>
      )}

      {loading && (
        <div className="teacher-performance-loading">
          Loading performance...
        </div>
      )}

      {!loading &&
        learner && (
          <>

            <section className="teacher-performance-overall">

              <span>
                OVERALL MASTERY
              </span>

              <strong>
                {overallPercentage ===
                null
                  ? "Not started"
                  : `${overallPercentage}% · ${overallLevel}`}
              </strong>

              <p>
                {completedAssignments.length ===
                0
                  ? "No completed activities yet."
                  : `${attemptedTopics} ${
                      attemptedTopics ===
                      1
                        ? "topic"
                        : "topics"
                    } attempted`}
              </p>

            </section>

            <div className="teacher-performance-section-heading">

              <h3>
                Topic Mastery
              </h3>

            </div>

            <section className="teacher-performance-topics">

              {topics.map(
                (
                  topic
                ) => (
                  <div
                    key={
                      topic.topic
                    }
                    className="teacher-performance-topic"
                  >

                    <div>

                      <strong>
                        {
                          topic.topic
                        }
                      </strong>

                      <span>
                        {
                          topic.completedCount
                        }{" "}
                        completed
                      </span>

                    </div>

                    <div className="teacher-performance-topic-result">

                      {topic.percentage ===
                      null
                        ? "Not started"
                        : `${topic.percentage}% · ${topic.level}`}

                    </div>

                  </div>
                )
              )}

            </section>

            <div className="teacher-performance-section-heading recommendation">

              <div>

                <h3>
                  Recommendation
                </h3>

                <p>
                  {pendingRecommendations}{" "}
                  pending review
                </p>

              </div>

              <select
                value={
                  selectedTopic
                }
                onChange={(
                  event
                ) =>
                  setSelectedTopic(
                    event.target.value
                  )
                }
              >
                {SUPPORTED_TOPICS.map(
                  (
                    topic
                  ) => (
                    <option
                      key={
                        topic
                      }
                      value={
                        topic
                      }
                    >
                      {topic}
                    </option>
                  )
                )}

              </select>

            </div>

            {!currentRecommendation && (
              <section className="teacher-performance-empty-card">

                Complete a scored{" "}
                <strong>
                  {selectedTopic}
                </strong>{" "}
                activity to generate its
                recommendation.

              </section>
            )}

            {currentRecommendation && (
              <section className="teacher-performance-recommendation">

                <span
                  className={`teacher-performance-recommendation-status ${currentRecommendation.status}`}
                >
                  {recommendationStatus(
                    currentRecommendation.status
                  )}
                </span>

                <h4>
                  {
                    currentRecommendation.topic
                  }{" "}
                  ·{" "}
                  {capitalized(
                    currentRecommendation.recommendedDifficulty
                  )}{" "}
                  ·{" "}
                  {
                    currentRecommendation.recommendedMinNumber
                  }
                  –
                  {
                    currentRecommendation.recommendedMaxNumber
                  }
                </h4>

                <p className="teacher-performance-recommendation-summary">

                  {
                    currentRecommendation.masteryPercent
                  }
                  % correct
                  (includes retries)

                  {" · "}

                  {
                    currentRecommendation.questionCount ||
                    "—"
                  }{" "}
                  questions

                </p>

                <p className="teacher-performance-recommendation-reason">

                  {currentRecommendation.reason ||
                    "Practice the recommended topic."}

                </p>

                {currentRecommendation.assignmentId && (
                  <div className="teacher-performance-assigned-notice">
                    Assigned to this
                    learner. Tap their card
                    on an available Smart
                    Board to begin.
                  </div>
                )}

                {currentRecommendation.previewQuestions.length >
                  0 && (
                  <div className="teacher-performance-disclosure">

                    <button
                      type="button"
                      onClick={() =>
                        setPreviewOpen(
                          (
                            current
                          ) =>
                            !current
                        )
                      }
                    >
                      Preview questions (
                      {
                        currentRecommendation.questionCount
                      }
                      ){" "}
                      {previewOpen
                        ? "⌃"
                        : "⌄"}
                    </button>

                    {previewOpen && (
                      <div className="teacher-performance-preview-list">

                        {currentRecommendation.previewQuestions.map(
                          (
                            question
                          ) => (
                            <div
                              key={
                                question.number
                              }
                              className="teacher-performance-preview-question"
                            >

                              <strong>
                                {
                                  question.number
                                }
                                .{" "}
                                {
                                  question.prompt
                                }
                              </strong>

                              <span>
                                Answer:{" "}
                                {
                                  question.correctAnswer
                                }
                              </span>

                            </div>
                          )
                        )}

                      </div>
                    )}

                  </div>
                )}

                {currentRecommendation.status ===
                  "pending" &&
                  currentRecommendation.previewQuestions.length ===
                    0 && (
                    <div className="teacher-performance-preview-missing">
                      Preview not ready.
                      Reopen this page to
                      retry.
                    </div>
                  )}

                <div className="teacher-performance-disclosure">

                  <button
                    type="button"
                    onClick={() =>
                      setWhyOpen(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                  >
                    Why this
                    recommendation?{" "}
                    {whyOpen
                      ? "⌃"
                      : "⌄"}
                  </button>

                  {whyOpen && (
                    <div className="teacher-performance-evidence">

                      {currentRecommendation.evidence && (
                        <p>
                          {
                            currentRecommendation.evidence
                          }
                        </p>
                      )}

                      <p>
                        {
                          currentRecommendation.reason
                        }
                      </p>

                    </div>
                  )}

                </div>

                {currentRecommendation.status ===
                  "pending" && (
                  <div className="teacher-performance-review-actions">

                    <button
                      type="button"
                      className="teacher-performance-dismiss"
                      disabled={
                        reviewing
                      }
                      onClick={() => {
                        void handleReview(
                          "dismissed"
                        );
                      }}
                    >
                      {reviewing
                        ? "Updating..."
                        : "Dismiss"}
                    </button>

                    <button
                      type="button"
                      className="teacher-performance-approve"
                      disabled={
                        reviewing ||
                        !previewOpen ||
                        currentRecommendation
                          .previewQuestions
                          .length ===
                          0
                      }
                      onClick={() => {
                        void handleReview(
                          "approved"
                        );
                      }}
                    >
                      {reviewing
                        ? "Updating..."
                        : "Approve"}
                    </button>

                  </div>
                )}

              </section>
            )}

            <div className="teacher-performance-section-heading history">

              <h3>
                Activity History (
                {
                  completedAssignments.length
                }
                )
              </h3>

            </div>

            <button
              type="button"
              className="teacher-performance-detailed-results"
              onClick={() =>
                navigate(
                  `/teacher/learners/${learnerId}/results`
                )
              }
            >
              View detailed session results
            </button>

            {completedAssignments.length ===
              0 && (
              <section className="teacher-performance-empty-card">
                No completed activities
                yet.
              </section>
            )}

            {completedAssignments.length >
              0 && (
              <div className="teacher-performance-history">

                {completedAssignments.map(
                  (
                    assignment
                  ) => (
                    <button
                      key={
                        assignment.id
                      }
                      type="button"
                      className="teacher-performance-history-card"
                      onClick={() =>
                        navigate(
                          `/teacher/learners/${learnerId}/results?assignmentId=${encodeURIComponent(
                            assignment.id
                          )}`
                        )
                      }
                    >

                      <div>

                        <strong>
                          {assignment.activityTitle ||
                            "Completed activity"}
                        </strong>

                        <p>
                          {
                            assignment.topic
                          }
                          {" · "}

                          {assignment.score !==
                            null &&
                          assignment.totalQuestions !==
                            null
                            ? `${assignment.score} of ${assignment.totalQuestions} correct`
                            : "Score unavailable"}

                          {" · "}

                          {assignment.masteryPercent !==
                          null
                            ? `${assignment.masteryPercent}% · ${masteryLevel(
                                assignment.masteryPercent
                              )}`
                            : "Mastery unavailable"}
                        </p>

                      </div>

                      <span>
                        {formatDate(
                          assignment.completedAt
                        )}
                      </span>

                    </button>
                  )
                )}

              </div>
            )}

          </>
        )}

    </TeacherLayout>
  );
}

export default TeacherLearnerPerformancePage;