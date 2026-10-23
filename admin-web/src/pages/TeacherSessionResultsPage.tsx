import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
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

import "./TeacherSessionResultsPage.css";

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

  status: string;

  totalQuestions: number;

  correctAnswers: number;
  unsuccessfulAnswers: number;

  score:
    | number
    | null;

  accuracyPercent:
    | number
    | null;

  resultSynced: boolean;

  startedAt:
    | Timestamp
    | null;

  endedAt:
    | Timestamp
    | null;
}

interface SessionResponse {
  id: string;

  teacherId: string;
  sessionId: string;

  questionNumber: number;

  prompt: string;

  correctAnswer: number;

  submittedAnswer:
    | number
    | null;

  submittedAnswers:
    number[];

  isCorrect:
    | boolean
    | null;

  attemptCount: number;

  responseTimeMillis:
    | number
    | null;

  responseTimesMillis:
    number[];

  status: string;
}

const SUPPORTED_TOPICS = [
  "Number Sense",
  "Addition",
  "Subtraction",
];

function formatDuration(
  milliseconds:
    number | null
): string {
  if (
    milliseconds ===
      null ||
    milliseconds < 0
  ) {
    return "Not recorded";
  }

  if (
    milliseconds <
    60_000
  ) {
    return `${(
      milliseconds /
      1000
    ).toFixed(
      1
    )} s`;
  }

  const minutes =
    Math.floor(
      milliseconds /
        60_000
    );

  const seconds =
    (
      (
        milliseconds %
        60_000
      ) /
      1000
    ).toFixed(
      1
    );

  return `${minutes} min ${seconds} s`;
}

function formatDate(
  timestamp:
    Timestamp | null
): string {
  if (!timestamp) {
    return "Date not recorded";
  }

  return timestamp
    .toDate()
    .toLocaleString(
      "en-US",
      {
        year:
          "numeric",

        month:
          "short",

        day:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit",
      }
    );
}

function topicSummary(
  sessions:
    LiveSession[]
) {
  return SUPPORTED_TOPICS.map(
    (
      topic
    ) => {
      const records =
        sessions.filter(
          (
            session
          ) =>
            session.topic.toLowerCase() ===
              topic.toLowerCase() &&
            session.status ===
              "completed"
        );

      const scored =
        records.filter(
          (
            session
          ) =>
            session.score !==
              null &&
            session.totalQuestions >
              0 &&
            session.score >=
              0 &&
            session.score <=
              session.totalQuestions
        );

      if (
        records.length ===
        0
      ) {
        return {
          topic,

          text:
            "Not started",
        };
      }

      if (
        scored.length ===
        0
      ) {
        return {
          topic,

          text:
            `${records.length} ${
              records.length ===
              1
                ? "session"
                : "sessions"
            } · Score unavailable`,
        };
      }

      const correct =
        scored.reduce(
          (
            total,
            session
          ) =>
            total +
            (
              session.score ??
              0
            ),
          0
        );

      const totalQuestions =
        scored.reduce(
          (
            total,
            session
          ) =>
            total +
            session.totalQuestions,
          0
        );

      const unavailable =
        scored.length <
        records.length;

      return {
        topic,

        text:
          `${correct} / ${totalQuestions} correct · ${records.length} ${
            records.length ===
            1
              ? "session"
              : "sessions"
          }${
            unavailable
              ? " · Some scores unavailable"
              : ""
          }`,
      };
    }
  );
}

function responseOutcome(
  response:
    SessionResponse
): string {
  if (
    response.isCorrect ===
    true
  ) {
    return "Correct";
  }

  if (
    response.isCorrect ===
    false
  ) {
    return "Incorrect";
  }

  return "Outcome not recorded";
}

function TeacherSessionResultsPage() {
  const navigate =
    useNavigate();

  const {
    learnerId,
  } =
    useParams<{
      learnerId: string;
    }>();

  const [
    searchParams,
  ] =
    useSearchParams();

  const assignmentId =
    searchParams.get(
      "assignmentId"
    );

  const [
    sessions,
    setSessions,
  ] =
    useState<
      LiveSession[]
    >([]);

  const [
    selectedSessionId,
    setSelectedSessionId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    responses,
    setResponses,
  ] =
    useState<
      SessionResponse[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    loadingResponses,
    setLoadingResponses,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /*
   * =========================
   * LOAD COMPLETED SESSIONS
   * =========================
   */

  useEffect(() => {
    if (!learnerId) {
      navigate(
        "/teacher/learners"
      );

      return;
    }

    let unsubscribeSessions:
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
                if (
                  auth.currentUser
                    ?.uid !==
                  user.uid
                ) {
                  return;
                }

                const list =
                  snapshot.docs
                    .map(
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

                          status:
                            data.status ??
                            "",

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

                          resultSynced:
                            data.resultSynced ===
                            true,

                          startedAt:
                            data.startedAt ??
                            null,

                          endedAt:
                            data.endedAt ??
                            null,
                        };
                      }
                    )
                    .filter(
                      (
                        session
                      ) =>
                        session.status ===
                          "completed" &&
                        session.teacherId ===
                          user.uid &&
                        session.learnerId ===
                          learnerId &&
                        (
                          !assignmentId ||
                          session.assignmentId ===
                            assignmentId
                        )
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
                    );

                setSessions(
                  list
                );

                setSelectedSessionId(
                  (
                    current
                  ) =>
                    current &&
                    list.some(
                      (
                        session
                      ) =>
                        session.id ===
                        current
                    )
                      ? current
                      : null
                );

                setLoading(
                  false
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  "Could not load session results:",
                  snapshotError
                );

                setError(
                  "Could not load results. Check your connection and permissions."
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

      unsubscribeSessions?.();
    };
  }, [
    learnerId,
    assignmentId,
    navigate,
  ]);

  const selectedSession =
    useMemo(
      () =>
        sessions.find(
          (
            session
          ) =>
            session.id ===
            selectedSessionId
        ) ??
        null,
      [
        sessions,
        selectedSessionId,
      ]
    );

  /*
   * =========================
   * LOAD QUESTION RESPONSES
   * =========================
   */

  useEffect(() => {
    if (
      !selectedSession
    ) {
      setResponses(
        []
      );

      setLoadingResponses(
        false
      );

      return;
    }

    const user =
      auth.currentUser;

    if (
      !user ||
      user.uid !==
        selectedSession.teacherId
    ) {
      return;
    }

    setLoadingResponses(
      true
    );

    setError(
      ""
    );

    const responsesQuery =
      query(
        collection(
          db,
          "liveSessions",
          selectedSession.id,
          "responses"
        ),
        where(
          "sessionId",
          "==",
          selectedSession.id
        )
      );

    const unsubscribe =
      onSnapshot(
        responsesQuery,
        (
          snapshot
        ) => {
          if (
            auth.currentUser
              ?.uid !==
            selectedSession.teacherId
          ) {
            return;
          }

          const list =
            snapshot.docs
              .map(
                (
                  responseDocument
                ): SessionResponse => {
                  const data =
                    responseDocument.data();

                  return {
                    id:
                      responseDocument.id,

                    teacherId:
                      data.teacherId ??
                      "",

                    sessionId:
                      data.sessionId ??
                      "",

                    questionNumber:
                      Number(
                        data.questionNumber ??
                          0
                      ),

                    prompt:
                      data.prompt ??
                      "",

                    correctAnswer:
                      Number(
                        data.correctAnswer ??
                          0
                      ),

                    submittedAnswer:
                      data.submittedAnswer ===
                        null ||
                      data.submittedAnswer ===
                        undefined
                        ? null
                        : Number(
                            data.submittedAnswer
                          ),

                    submittedAnswers:
                      Array.isArray(
                        data.submittedAnswers
                      )
                        ? data.submittedAnswers.map(
                            (
                              value:
                                unknown
                            ) =>
                              Number(
                                value
                              )
                          )
                        : [],

                    isCorrect:
                      typeof data.isCorrect ===
                      "boolean"
                        ? data.isCorrect
                        : null,

                    attemptCount:
                      Number(
                        data.attemptCount ??
                          0
                      ),

                    responseTimeMillis:
                      data.responseTimeMillis ===
                        null ||
                      data.responseTimeMillis ===
                        undefined
                        ? null
                        : Number(
                            data.responseTimeMillis
                          ),

                    responseTimesMillis:
                      Array.isArray(
                        data.responseTimesMillis
                      )
                        ? data.responseTimesMillis.map(
                            (
                              value:
                                unknown
                            ) =>
                              Number(
                                value
                              )
                          )
                        : [],

                    status:
                      data.status ??
                      "pending",
                  };
                }
              )
              .sort(
                (
                  first,
                  second
                ) =>
                  first.questionNumber -
                  second.questionNumber
              );

          setResponses(
            list
          );

          setLoadingResponses(
            false
          );
        },
        (
          responseError
        ) => {
          console.error(
            "Could not load question results:",
            responseError
          );

          setError(
            "Could not load question results."
          );

          setLoadingResponses(
            false
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    selectedSession,
  ]);

  const summaries =
    useMemo(
      () =>
        topicSummary(
          sessions
        ),
      [
        sessions,
      ]
    );

  const handleBack =
    () => {
      if (
        selectedSessionId
      ) {
        setSelectedSessionId(
          null
        );

        return;
      }

      navigate(
        `/teacher/learners/${learnerId}/performance`
      );
    };

  return (
    <TeacherLayout>

      <div className="teacher-results-heading">

        <button
          type="button"
          className="teacher-results-back"
          onClick={
            handleBack
          }
        >
          ←{" "}
          {selectedSessionId
            ? "Session Results"
            : "Learner Performance"}
        </button>

        <span className="teacher-results-eyebrow">
          COMPLETED LEARNING
        </span>

        <h2>
          Session Results
        </h2>

        <p>
          Review completed Smart Board
          sessions and question-by-question
          results.
        </p>

      </div>

      {error && (
        <div
          className="teacher-results-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="teacher-results-loading">
          Loading results...
        </div>
      )}

      {!loading &&
        !selectedSession && (
          <>

            {sessions.length ===
              0 && (
              <section className="teacher-results-empty">

                <h3>
                  No detailed sessions yet
                </h3>

                <p>
                  Older assignment summaries
                  may not have question
                  records. Complete a learning
                  session to see its detailed
                  results here.
                </p>

              </section>
            )}

            {sessions.length >
              0 && (
              <>

                <section className="teacher-results-topic-summary">

                  <h3>
                    Results by Topic
                  </h3>

                  {summaries.map(
                    (
                      summary
                    ) => (
                      <div
                        key={
                          summary.topic
                        }
                        className="teacher-results-topic-row"
                      >

                        <strong>
                          {
                            summary.topic
                          }
                        </strong>

                        <span>
                          {
                            summary.text
                          }
                        </span>

                      </div>
                    )
                  )}

                  <details className="teacher-results-details">

                    <summary>
                      How scores work
                    </summary>

                    <p>
                      Correct includes answers
                      reached within the three
                      allowed attempts.
                    </p>

                  </details>

                </section>

                <div className="teacher-results-session-list">

                  {sessions.map(
                    (
                      session
                    ) => (
                      <button
                        key={
                          session.id
                        }
                        type="button"
                        className="teacher-results-session-card"
                        onClick={() =>
                          setSelectedSessionId(
                            session.id
                          )
                        }
                      >

                        <div className="teacher-results-session-main">

                          <strong>
                            {session.activityTitle ||
                              "Untitled activity"}
                          </strong>

                          <span>
                            {session.learnerName ||
                              "Learner name not recorded"}
                          </span>

                          <small>
                            {session.topic ||
                              "Topic not recorded"}{" "}
                            ·{" "}
                            {formatDate(
                              session.endedAt
                            )}
                          </small>

                        </div>

                        <div className="teacher-results-session-score">

                          <strong>
                            {session.score ??
                              "—"}{" "}
                            /{" "}
                            {
                              session.totalQuestions
                            }
                          </strong>

                          <span>
                            correct
                          </span>

                          <small>
                            View results ›
                          </small>

                        </div>

                      </button>
                    )
                  )}

                </div>

              </>
            )}

          </>
        )}

      {!loading &&
        selectedSession && (
          <>

            <section className="teacher-results-session-header">

              <span className="teacher-results-section-label">
                COMPLETED SESSION
              </span>

              <h3>
                {selectedSession.activityTitle ||
                  "Untitled activity"}
              </h3>

              <p>
                {selectedSession.learnerName ||
                  "Learner name not recorded"}
              </p>

              <p className="teacher-results-session-meta">
                {selectedSession.topic ||
                  "Topic not recorded"}{" "}
                ·{" "}
                {selectedSession.boardName ||
                  "Board not recorded"}
              </p>

              <div className="teacher-results-big-score">

                <strong>
                  {selectedSession.score ??
                    "—"}{" "}
                  /{" "}
                  {
                    selectedSession.totalQuestions
                  }
                </strong>

                <span>
                  correct
                </span>

              </div>

              <div
                className={
                  selectedSession.resultSynced
                    ? "teacher-results-sync saved"
                    : "teacher-results-sync pending"
                }
              >
                {selectedSession.resultSynced
                  ? "Saved to learner progress"
                  : "Progress sync pending"}
              </div>

              <details className="teacher-results-details">

                <summary>
                  About response times
                </summary>

                <p>
                  Times are recorded per
                  submission, not added
                  together. Missing times are
                  marked “Not recorded”.
                </p>

              </details>

            </section>

            {loadingResponses && (
              <div className="teacher-results-loading">
                Loading questions...
              </div>
            )}

            {!loadingResponses &&
              responses.length !==
                selectedSession.totalQuestions && (
                <div className="teacher-results-warning">

                  Some question records are
                  missing (
                  {
                    responses.length
                  }{" "}
                  /{" "}
                  {
                    selectedSession.totalQuestions
                  }
                  ).

                </div>
              )}

            {!loadingResponses &&
              responses.map(
                (
                  response
                ) => {
                  const answers =
                    response.submittedAnswers
                      .length >
                    0
                      ? response.submittedAnswers
                      : response.submittedAnswer !==
                          null
                        ? [
                            response.submittedAnswer,
                          ]
                        : [];

                  return (
                    <section
                      key={
                        response.id
                      }
                      className="teacher-results-question-card"
                    >

                      <span className="teacher-results-question-number">
                        QUESTION{" "}
                        {
                          response.questionNumber
                        }
                      </span>

                      <h4>
                        {response.prompt ||
                          "Prompt not recorded"}
                      </h4>

                      <div
                        className={
                          response.isCorrect ===
                          true
                            ? "teacher-results-outcome correct"
                            : response.isCorrect ===
                                false
                              ? "teacher-results-outcome incorrect"
                              : "teacher-results-outcome"
                        }
                      >
                        {responseOutcome(
                          response
                        )}{" "}
                        ·{" "}
                        {
                          response.attemptCount
                        }
                        /3 attempts
                      </div>

                      <p className="teacher-results-latest-time">
                        Latest time:{" "}
                        {formatDuration(
                          response.responseTimeMillis
                        )}
                      </p>

                      <details className="teacher-results-details answers">

                        <summary>
                          View answers and
                          attempts
                        </summary>

                        <div className="teacher-results-answer-details">

                          <p>
                            <strong>
                              Question{" "}
                              {
                                response.questionNumber
                              }
                              :
                            </strong>{" "}
                            {response.prompt ||
                              "Prompt not recorded"}
                          </p>

                          <p>
                            <strong>
                              {response.isCorrect ===
                              true
                                ? "Correct"
                                : response.isCorrect ===
                                    false
                                  ? "Incorrect — attempts exhausted"
                                  : "Outcome not recorded"}
                            </strong>
                          </p>

                          <p>
                            Expected answer:{" "}
                            <strong>
                              {
                                response.correctAnswer
                              }
                            </strong>
                          </p>

                          <p>
                            Attempts used:{" "}
                            {
                              response.attemptCount
                            }{" "}
                            / 3
                          </p>

                          {answers.length ===
                            0 && (
                            <p>
                              Submitted answers:
                              Not recorded
                            </p>
                          )}

                          {answers.map(
                            (
                              answer,
                              index
                            ) => {
                              const responseTime =
                                response
                                  .responseTimesMillis[
                                  index
                                ] ??
                                (
                                  response
                                    .submittedAnswers
                                    .length ===
                                  0
                                    ? response.responseTimeMillis
                                    : null
                                );

                              return (
                                <div
                                  key={`${response.id}-${index}`}
                                  className="teacher-results-attempt"
                                >

                                  <strong>
                                    {response
                                      .submittedAnswers
                                      .length ===
                                    0
                                      ? "Last recorded answer"
                                      : `Attempt ${index + 1}`}
                                  </strong>

                                  <span>
                                    Answer:{" "}
                                    {
                                      answer
                                    }
                                  </span>

                                  <span
                                    className={
                                      answer ===
                                      response.correctAnswer
                                        ? "correct"
                                        : "incorrect"
                                    }
                                  >
                                    {answer ===
                                    response.correctAnswer
                                      ? "Correct"
                                      : "Incorrect"}
                                  </span>

                                  <span>
                                    Recorded time:{" "}
                                    {formatDuration(
                                      responseTime
                                    )}
                                  </span>

                                </div>
                              );
                            }
                          )}

                          <p>
                            Latest response
                            time:{" "}
                            <strong>
                              {formatDuration(
                                response.responseTimeMillis
                              )}
                            </strong>
                          </p>

                        </div>

                      </details>

                    </section>
                  );
                }
              )}

          </>
        )}

    </TeacherLayout>
  );
}

export default TeacherSessionResultsPage;