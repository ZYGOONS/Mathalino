import {
  useEffect,
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
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import {
  buildTeacherMadeQuestion,
  generateActivityQuestions,
  type GeneratedQuestion,
  type QuestionActivity,
} from "../services/activityQuestionGenerator";

import "./TeacherQuestionPreviewPage.css";

type QuestionSource =
  | "generated"
  | "teacher-made";

interface ActivityRecord
  extends QuestionActivity {
  id: string;

  teacherId: string;

  grade: string;

  description: string;

  status: string;

  questionSource:
    QuestionSource;
}

interface ManualQuestionDraft {
  number: number;

  questionType: string;

  firstOperand: string;

  secondOperand: string;
}

function difficultyLabel(
  difficulty: string
): string {
  switch (
    difficulty
      .trim()
      .toLowerCase()
  ) {
    case "easy":
      return "Easy";

    case "average":
      return "Average";

    case "difficult":
      return "Difficult";

    default:
      return difficulty ||
        "—";
  }
}

function questionTypeLabel(
  type: string
): string {
  switch (
    type
  ) {
    case "addition":
      return "Addition";

    case "subtraction":
      return "Subtraction";

    case "greater":
      return "Greater Number";

    case "smaller":
      return "Smaller Number";

    case "after":
      return "Number After";

    case "before":
      return "Number Before";

    case "missing":
      return "Missing Number";

    default:
      return type ||
        "Question";
  }
}

function normalizeQuestion(
  value: unknown,
  index: number
): GeneratedQuestion {
  const data =
    (
      value &&
      typeof value ===
        "object"
    )
      ? value as Record<
          string,
          unknown
        >
      : {};

  const firstOperand =
    data.firstOperand ===
        null ||
    data.firstOperand ===
        undefined
      ? null
      : Number(
          data.firstOperand
        );

  const secondOperand =
    data.secondOperand ===
        null ||
    data.secondOperand ===
        undefined
      ? null
      : Number(
          data.secondOperand
        );

  return {
    number:
      Number(
        data.number ??
          index + 1
      ),

    prompt:
      String(
        data.prompt ??
          ""
      ),

    correctAnswer:
      Number(
        data.correctAnswer ??
          0
      ),

    firstOperand,

    operator:
      String(
        data.operator ??
          ""
      ),

    secondOperand,

    questionType:
      String(
        data.questionType ??
          ""
      ),
  };
}

function defaultQuestionType(
  topic: string
): string {
  const normalized =
    topic
      .trim()
      .toLowerCase();

  if (
    normalized ===
    "addition"
  ) {
    return "addition";
  }

  if (
    normalized ===
    "subtraction"
  ) {
    return "subtraction";
  }

  return "greater";
}

function createManualDrafts(
  activity:
    ActivityRecord
): ManualQuestionDraft[] {
  if (
    activity.savedQuestions.length >
    0
  ) {
    return activity.savedQuestions.map(
      (
        question
      ) => ({
        number:
          question.number,

        questionType:
          question.questionType,

        firstOperand:
          question.firstOperand ===
          null
            ? ""
            : String(
                question.firstOperand
              ),

        secondOperand:
          question.secondOperand ===
          null
            ? ""
            : String(
                question.secondOperand
              ),
      })
    );
  }

  return Array.from(
    {
      length:
        activity.questionCount,
    },
    (
      _,
      index
    ) => ({
      number:
        index + 1,

      questionType:
        defaultQuestionType(
          activity.topic
        ),

      firstOperand:
        "",

      secondOperand:
        "",
    })
  );
}

function TeacherQuestionPreviewPage() {
  const navigate =
    useNavigate();

  const {
    activityId,
  } =
    useParams<{
      activityId: string;
    }>();

  const [
    activity,
    setActivity,
  ] =
    useState<ActivityRecord | null>(
      null
    );

  const [
    questions,
    setQuestions,
  ] =
    useState<
      GeneratedQuestion[]
    >(
      []
    );

  const [
    manualDrafts,
    setManualDrafts,
  ] =
    useState<
      ManualQuestionDraft[]
    >(
      []
    );

  const [
    saved,
    setSaved,
  ] =
    useState(
      false
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    cancelling,
    setCancelling,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    success,
    setSuccess,
  ] =
    useState(
      ""
    );

  useEffect(
    () => {
      if (
        !activityId
      ) {
        navigate(
          "/teacher/activities"
        );

        return;
      }

      const unsubscribe =
        onAuthStateChanged(
          auth,
          async (
            user
          ) => {
            if (
              !user
            ) {
              navigate(
                "/"
              );

              return;
            }

            try {
              setLoading(
                true
              );

              setError(
                ""
              );

              const reference =
                doc(
                  db,
                  "activities",
                  activityId
                );

              const snapshot =
                await getDoc(
                  reference
                );

              if (
                !snapshot.exists()
              ) {
                setError(
                  "Activity was not found."
                );

                setLoading(
                  false
                );

                return;
              }

              const data =
                snapshot.data();

              if (
                data.teacherId !==
                user.uid
              ) {
                setError(
                  "This activity does not belong to your account."
                );

                setLoading(
                  false
                );

                return;
              }

              const savedQuestions =
                Array.isArray(
                  data.savedQuestions
                )
                  ? data.savedQuestions.map(
                      normalizeQuestion
                    )
                  : [];

              const questionSource:
                QuestionSource =
                data.questionSource ===
                "teacher-made"
                  ? "teacher-made"
                  : "generated";

              const loadedActivity:
                ActivityRecord = {
                id:
                  snapshot.id,

                teacherId:
                  data.teacherId ??
                  "",

                title:
                  data.title ??
                  "",

                topic:
                  data.topic ??
                  "",

                grade:
                  data.grade ??
                  "",

                difficulty:
                  data.difficulty ??
                  "easy",

                description:
                  data.description ??
                  "",

                status:
                  data.status ??
                  "active",

                questionCount:
                  Number(
                    data.questionCount ??
                      0
                  ),

                minNumber:
                  Number(
                    data.minNumber ??
                      0
                  ),

                maxNumber:
                  Number(
                    data.maxNumber ??
                      10
                  ),

                savedQuestions,

                questionSource,
              };

              setActivity(
                loadedActivity
              );

              if (
                questionSource ===
                "generated"
              ) {
                const generated =
                  generateActivityQuestions(
                    loadedActivity
                  );

                setQuestions(
                  generated
                );

                setManualDrafts(
                  []
                );
              } else {
                setQuestions(
                  savedQuestions
                );

                setManualDrafts(
                  createManualDrafts(
                    loadedActivity
                  )
                );
              }

              setSaved(
                savedQuestions.length >
                0
              );

              setLoading(
                false
              );
            } catch (
              loadError
            ) {
              console.error(
                "Could not load question preview:",
                loadError
              );

              setError(
                loadError instanceof
                Error
                  ? loadError.message
                  : "Could not load the question preview."
              );

              setLoading(
                false
              );
            }
          }
        );

      return () => {
        unsubscribe();
      };
    },
    [
      activityId,
      navigate,
    ]
  );

  const handleRegenerate =
    () => {
      if (
        !activity ||
        saved ||
        activity.questionSource !==
          "generated"
      ) {
        return;
      }

      try {
        setError(
          ""
        );

        setSuccess(
          ""
        );

        const generated =
          generateActivityQuestions({
            ...activity,

            savedQuestions:
              [],
          });

        setQuestions(
          generated
        );
      } catch (
        generationError
      ) {
        console.error(
          "Could not regenerate questions:",
          generationError
        );

        setError(
          generationError instanceof
          Error
            ? generationError.message
            : "Could not regenerate questions."
        );
      }
    };

  const updateManualDraft =
    (
      index: number,
      changes:
        Partial<
          ManualQuestionDraft
        >
    ) => {
      setManualDrafts(
        (
          current
        ) =>
          current.map(
            (
              draft,
              draftIndex
            ) =>
              draftIndex ===
              index
                ? {
                    ...draft,
                    ...changes,
                  }
                : draft
          )
      );

      setError(
        ""
      );

      setSuccess(
        ""
      );
    };

  const buildManualQuestions =
    (): GeneratedQuestion[] => {
      if (
        !activity
      ) {
        return [];
      }

      return manualDrafts.map(
        (
          draft,
          index
        ) => {
          const first =
            draft.firstOperand.trim() ===
            ""
              ? null
              : Number(
                  draft.firstOperand
                );

          const second =
            draft.secondOperand.trim() ===
            ""
              ? null
              : Number(
                  draft.secondOperand
                );

          try {
            return buildTeacherMadeQuestion(
              activity,
              {
                number:
                  index + 1,

                questionType:
                  draft.questionType,

                firstOperand:
                  first,

                secondOperand:
                  second,
              }
            );
          } catch (
            questionError
          ) {
            const message =
              questionError instanceof
              Error
                ? questionError.message
                : "Invalid question.";

            throw new Error(
              `Question ${index + 1}: ${message}`
            );
          }
        }
      );
    };

  /*
   * =========================
   * CANCEL UNSAVED ACTIVITY
   * =========================
   */

  const handleCancel =
    async () => {
      if (
        !activity ||
        !activityId
      ) {
        navigate(
          "/teacher/activities"
        );

        return;
      }

      /*
       * Once the question set is saved,
       * this button behaves like normal
       * back navigation.
       */
      if (
        saved
      ) {
        navigate(
          `/teacher/activities/${activityId}`
        );

        return;
      }

      const confirmed =
        window.confirm(
          "Cancel this activity?\n\nThe unsaved activity and its question set will be discarded."
        );

      if (
        !confirmed
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (
        !user ||
        user.uid !==
          activity.teacherId
      ) {
        navigate(
          "/"
        );

        return;
      }

      try {
        setCancelling(
          true
        );

        setError(
          ""
        );

        /*
         * We intentionally UPDATE instead
         * of DELETE.
         *
         * Teacher Firestore permissions
         * allow updating owned activities,
         * while document deletion is not
         * currently permitted.
         *
         * libraryVisible:false ensures
         * this cancelled draft will not
         * appear in the Activity Library.
         */
        await updateDoc(
          doc(
            db,
            "activities",
            activityId
          ),
          {
            status:
              "cancelled",

            libraryVisible:
              false,

            trashed:
              true,

            savedQuestions:
              [],

            updatedAt:
              serverTimestamp(),
          }
        );

        navigate(
          "/teacher/activities",
          {
            replace:
              true,
          }
        );
      } catch (
        cancelError
      ) {
        console.error(
          "Could not cancel activity:",
          cancelError
        );

        setError(
          cancelError instanceof
          Error
            ? cancelError.message
            : "Could not cancel the activity."
        );
      } finally {
        setCancelling(
          false
        );
      }
    };

  /*
   * =========================
   * SAVE QUESTION SET
   * =========================
   */

  const handleSave =
    async () => {
      if (
        !activityId ||
        !activity ||
        saved
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (
        !user ||
        user.uid !==
          activity.teacherId
      ) {
        navigate(
          "/"
        );

        return;
      }

      try {
        setSaving(
          true
        );

        setError(
          ""
        );

        setSuccess(
          ""
        );

        const finalQuestions =
          activity.questionSource ===
          "teacher-made"
            ? buildManualQuestions()
            : questions;

        if (
          finalQuestions.length !==
          activity.questionCount
        ) {
          throw new Error(
            "The question set does not match the activity question count."
          );
        }

        finalQuestions.forEach(
          (
            question,
            index
          ) => {
            if (
              question.number !==
              index + 1
            ) {
              throw new Error(
                "The question sequence is invalid."
              );
            }
          }
        );

        const reference =
          doc(
            db,
            "activities",
            activityId
          );

        await updateDoc(
          reference,
          {
            savedQuestions:
              finalQuestions,

            assignmentRevision:
              increment(
                1
              ),

            updatedAt:
              serverTimestamp(),
          }
        );

        setQuestions(
          finalQuestions
        );

        setActivity(
          (
            current
          ) =>
            current
              ? {
                  ...current,

                  savedQuestions:
                    finalQuestions,
                }
              : current
        );

        setSaved(
          true
        );

        setSuccess(
          "Question set saved successfully."
        );
      } catch (
        saveError
      ) {
        console.error(
          "Could not save question set:",
          saveError
        );

        setError(
          saveError instanceof
          Error
            ? saveError.message
            : "Could not save the question set."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  if (
    loading
  ) {
    return (
      <TeacherLayout>

        <div className="teacher-question-preview-loading">
          Loading questions...
        </div>

      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>

      <div className="teacher-question-preview-heading">

        <button
          type="button"
          className="teacher-question-preview-back"
          disabled={
            cancelling
          }
          onClick={() => {
            void handleCancel();
          }}
        >
          {saved
            ? "← Activity Details"
            : "← Cancel Activity"}
        </button>

        <span className="teacher-question-preview-eyebrow">
          ACTIVITY MANAGEMENT
        </span>

        <h2>
          {activity?.questionSource ===
          "teacher-made"
            ? "Create Questions"
            : "Preview Questions"}
        </h2>

        <p>
          {activity?.questionSource ===
          "teacher-made"
            ? "Create the question set that will be used during the learner's Smart Analyzer Board session."
            : "Review the generated questions that will be used during the learner's Smart Analyzer Board session."}
        </p>

      </div>

      {error && (
        <div
          className="teacher-question-preview-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="teacher-question-preview-success"
          role="status"
        >
          {success}
        </div>
      )}

      {activity && (
        <>

          <section className="teacher-question-preview-summary">

            <div className="teacher-question-preview-summary-top">

              <div>

                <span>
                  {
                    activity.topic
                  }
                </span>

                <h3>
                  {activity.title ||
                    "Untitled Activity"}
                </h3>

              </div>

              <span
                className={
                  saved
                    ? "teacher-question-preview-badge saved"
                    : "teacher-question-preview-badge unsaved"
                }
              >
                {saved
                  ? "Saved Question Set"
                  : "Not Saved"}
              </span>

            </div>

            <div className="teacher-question-preview-meta">

              <div>
                <span>
                  GRADE
                </span>

                <strong>
                  {activity.grade ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  DIFFICULTY
                </span>

                <strong>
                  {difficultyLabel(
                    activity.difficulty
                  )}
                </strong>
              </div>

              <div>
                <span>
                  RANGE
                </span>

                <strong>
                  {
                    activity.minNumber
                  }
                  –
                  {
                    activity.maxNumber
                  }
                </strong>
              </div>

              <div>
                <span>
                  QUESTIONS
                </span>

                <strong>
                  {
                    activity.questionCount
                  }
                </strong>
              </div>

              <div>
                <span>
                  SOURCE
                </span>

                <strong>
                  {activity.questionSource ===
                  "teacher-made"
                    ? "Teacher-made"
                    : "Generated"}
                </strong>
              </div>

            </div>

          </section>

          <section
            className={
              saved
                ? "teacher-question-preview-notice saved"
                : "teacher-question-preview-notice"
            }
          >

            <strong>
              {saved
                ? "This question set is saved"
                : activity.questionSource ===
                    "teacher-made"
                  ? "Create each question before saving"
                  : "Review before saving"}
            </strong>

            <p>
              {saved
                ? "These questions are now saved for this activity."
                : activity.questionSource ===
                    "teacher-made"
                  ? `Enter question values within the ${activity.minNumber}–${activity.maxNumber} activity range.`
                  : "You may regenerate the questions until you are satisfied, then save the final set."}
            </p>

          </section>

          {!saved && (
            <div className="teacher-question-preview-actions">

              <button
                type="button"
                className="teacher-question-preview-cancel"
                disabled={
                  saving ||
                  cancelling
                }
                onClick={() => {
                  void handleCancel();
                }}
              >
                {cancelling
                  ? "Cancelling..."
                  : "Cancel"}
              </button>

              {activity.questionSource ===
                "generated" && (
                <button
                  type="button"
                  className="teacher-question-preview-regenerate"
                  disabled={
                    saving ||
                    cancelling
                  }
                  onClick={
                    handleRegenerate
                  }
                >
                  Regenerate Questions
                </button>
              )}

              <button
                type="button"
                className="teacher-question-preview-save"
                disabled={
                  saving ||
                  cancelling
                }
                onClick={() => {
                  void handleSave();
                }}
              >
                {saving
                  ? "Saving..."
                  : "Save Question Set"}
              </button>

            </div>
          )}

          {activity.questionSource ===
            "teacher-made" &&
          !saved ? (
            <section className="teacher-question-preview-section">

              <div className="teacher-question-preview-section-heading">

                <div>

                  <span>
                    TEACHER-MADE QUESTION SET
                  </span>

                  <h3>
                    {
                      manualDrafts.length
                    }{" "}
                    Questions
                  </h3>

                </div>

                <small>
                  Fill in each question before saving.
                </small>

              </div>

              <div className="teacher-manual-question-list">

                {manualDrafts.map(
                  (
                    draft,
                    index
                  ) => {
                    const normalizedTopic =
                      activity.topic
                        .trim()
                        .toLowerCase();

                    const isNumberSense =
                      normalizedTopic ===
                      "number sense";

                    const needsSecond =
                      ![
                        "after",
                        "before",
                      ].includes(
                        draft.questionType
                      );

                    return (
                      <article
                        key={
                          draft.number
                        }
                        className="teacher-manual-question-card"
                      >

                        <div className="teacher-manual-question-number">
                          {
                            index + 1
                          }
                        </div>

                        <div className="teacher-manual-question-fields">

                          {isNumberSense && (
                            <div className="teacher-manual-field full">

                              <label>
                                QUESTION TYPE
                              </label>

                              <select
                                value={
                                  draft.questionType
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateManualDraft(
                                    index,
                                    {
                                      questionType:
                                        event.target.value,

                                      secondOperand:
                                        [
                                          "after",
                                          "before",
                                        ].includes(
                                          event.target.value
                                        )
                                          ? ""
                                          : draft.secondOperand,
                                    }
                                  )
                                }
                              >
                                <option value="greater">
                                  Greater Number
                                </option>

                                <option value="smaller">
                                  Smaller Number
                                </option>

                                <option value="after">
                                  Number After
                                </option>

                                <option value="before">
                                  Number Before
                                </option>

                                <option value="missing">
                                  Missing Number
                                </option>
                              </select>

                            </div>
                          )}

                          <div className="teacher-manual-field">

                            <label>
                              {draft.questionType ===
                              "missing"
                                ? "STARTING NUMBER"
                                : "FIRST NUMBER"}
                            </label>

                            <input
                              type="number"
                              min={
                                activity.minNumber
                              }
                              max={
                                activity.maxNumber
                              }
                              value={
                                draft.firstOperand
                              }
                              placeholder={`${activity.minNumber}–${activity.maxNumber}`}
                              onChange={(
                                event
                              ) =>
                                updateManualDraft(
                                  index,
                                  {
                                    firstOperand:
                                      event.target.value,

                                    secondOperand:
                                      draft.questionType ===
                                      "missing"
                                        ? event.target.value ===
                                          ""
                                          ? ""
                                          : String(
                                              Number(
                                                event.target.value
                                              ) + 2
                                            )
                                        : draft.secondOperand,
                                  }
                                )
                              }
                            />

                          </div>

                          {needsSecond && (
                            <div className="teacher-manual-field">

                              <label>
                                {draft.questionType ===
                                "missing"
                                  ? "ENDING NUMBER"
                                  : "SECOND NUMBER"}
                              </label>

                              <input
                                type="number"
                                min={
                                  activity.minNumber
                                }
                                max={
                                  activity.maxNumber
                                }
                                value={
                                  draft.secondOperand
                                }
                                readOnly={
                                  draft.questionType ===
                                  "missing"
                                }
                                placeholder={`${activity.minNumber}–${activity.maxNumber}`}
                                onChange={(
                                  event
                                ) =>
                                  updateManualDraft(
                                    index,
                                    {
                                      secondOperand:
                                        event.target.value,
                                    }
                                  )
                                }
                              />

                            </div>
                          )}

                        </div>

                      </article>
                    );
                  }
                )}

              </div>

            </section>
          ) : (
            <section className="teacher-question-preview-section">

              <div className="teacher-question-preview-section-heading">

                <div>

                  <span>
                    QUESTION SET
                  </span>

                  <h3>
                    {
                      questions.length
                    }{" "}
                    Questions
                  </h3>

                </div>

                <small>
                  Answers are shown for teacher review only.
                </small>

              </div>

              {questions.length ===
                0 && (
                <div className="teacher-question-preview-empty">
                  No questions are available.
                </div>
              )}

              {questions.length >
                0 && (
                <div className="teacher-question-preview-list">

                  {questions.map(
                    (
                      question
                    ) => (
                      <article
                        key={
                          question.number
                        }
                        className="teacher-question-preview-card"
                      >

                        <div className="teacher-question-preview-number">
                          {
                            question.number
                          }
                        </div>

                        <div className="teacher-question-preview-content">

                          <span>
                            {questionTypeLabel(
                              question.questionType
                            )}
                          </span>

                          <strong>
                            {
                              question.prompt
                            }
                          </strong>

                        </div>

                        <div className="teacher-question-preview-answer">

                          <span>
                            ANSWER
                          </span>

                          <strong>
                            {
                              question.correctAnswer
                            }
                          </strong>

                        </div>

                      </article>
                    )
                  )}

                </div>
              )}

            </section>
          )}

          {saved && (
            <div className="teacher-question-preview-bottom">

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/teacher/activities/${activityId}`
                  )
                }
              >
                Back to Activity Details
              </button>

            </div>
          )}

        </>
      )}

    </TeacherLayout>
  );
}

export default TeacherQuestionPreviewPage;