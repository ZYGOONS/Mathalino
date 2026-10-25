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
  generateActivityQuestions,
  type GeneratedQuestion,
  type QuestionActivity,
} from "../services/activityQuestionGenerator";

import "./TeacherQuestionPreviewPage.css";

interface ActivityRecord
  extends QuestionActivity {
  id: string;

  teacherId: string;

  grade: string;

  description: string;

  status: string;
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
  switch (type) {
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
      typeof value === "object"
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
    >([]);

  const [
    saved,
    setSaved,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
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
   * LOAD
   * =========================
   */

  useEffect(() => {
    if (!activityId) {
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
          if (!user) {
            navigate("/");

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
            };

            setActivity(
              loadedActivity
            );

            /*
             * Existing saved set:
             * generator validates it.
             *
             * Empty set:
             * generator creates a
             * temporary preview.
             */

            const generated =
              generateActivityQuestions(
                loadedActivity
              );

            setQuestions(
              generated
            );

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
  }, [
    activityId,
    navigate,
  ]);

  /*
   * =========================
   * REGENERATE
   * =========================
   */

  const handleRegenerate =
    () => {
      if (
        !activity ||
        saved
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

            /*
             * Force a newly generated
             * unsaved set.
             */
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
        saved ||
        questions.length ===
          0
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
        navigate("/");

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

        /*
         * Validate the preview one
         * final time before saving.
         */
        if (
          questions.length !==
          activity.questionCount
        ) {
          throw new Error(
            "The question set does not match the activity question count."
          );
        }

        questions.forEach(
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
              questions,

            assignmentRevision:
              increment(
                1
              ),

            updatedAt:
              serverTimestamp(),
          }
        );

        setActivity(
          (
            current
          ) =>
            current
              ? {
                  ...current,

                  savedQuestions:
                    questions,
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
          onClick={() =>
            navigate(
              `/teacher/activities/${activityId}`
            )
          }
        >
          ← Activity Details
        </button>

        <span className="teacher-question-preview-eyebrow">
          ACTIVITY MANAGEMENT
        </span>

        <h2>
          Preview Questions
        </h2>

        <p>
          Review the questions that will
          be used during the learner's
          Smart Analyzer Board session.
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

          {/* ACTIVITY SUMMARY */}

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
                  : "Preview Not Saved"}
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

            </div>

          </section>

          {/* NOTICE */}

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
                : "Review before saving"}
            </strong>

            <p>
              {saved
                ? "These are the saved questions for this activity. To create a different set, edit a question-generating setting first, then return to Preview Questions."
                : "These questions are only a preview right now. You may regenerate them until you are satisfied, then save the final set."}
            </p>

          </section>

          {/* ACTION BAR */}

          {!saved && (
            <div className="teacher-question-preview-actions">

              <button
                type="button"
                className="teacher-question-preview-regenerate"
                disabled={
                  saving
                }
                onClick={
                  handleRegenerate
                }
              >
                Regenerate Questions
              </button>

              <button
                type="button"
                className="teacher-question-preview-save"
                disabled={
                  saving ||
                  questions.length ===
                    0
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

          {/* QUESTIONS */}

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
                Answers are shown for
                teacher review only.
              </small>

            </div>

            {questions.length ===
              0 && (
              <div className="teacher-question-preview-empty">

                No questions are
                available.

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

          {/* BOTTOM */}

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

        </>
      )}

    </TeacherLayout>
  );
}

export default TeacherQuestionPreviewPage;