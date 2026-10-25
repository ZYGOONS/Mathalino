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

import "./TeacherEditActivityPage.css";

type Topic =
  | "Number Sense"
  | "Addition"
  | "Subtraction";

type Difficulty =
  | "easy"
  | "average"
  | "difficult";

interface ActivityForm {
  title: string;
  description: string;
  topic: Topic;
  grade: string;
  difficulty: Difficulty;
  questionCount: string;
}

interface FormErrors {
  title?: string;
  questionCount?: string;
}

interface OriginalGeneratorSettings {
  topic: string;
  grade: string;
  difficulty: string;
  minNumber: number;
  maxNumber: number;
  questionCount: number;
}

const DIFFICULTY_RANGES: Record<
  Difficulty,
  {
    min: number;
    max: number;
  }
> = {
  easy: {
    min: 0,
    max: 10,
  },

  average: {
    min: 0,
    max: 20,
  },

  difficult: {
    min: 0,
    max: 50,
  },
};

function difficultyLabel(
  difficulty: Difficulty
): string {
  switch (difficulty) {
    case "easy":
      return "Easy";

    case "average":
      return "Average";

    case "difficult":
      return "Difficult";
  }
}

function TeacherEditActivityPage() {
  const navigate =
    useNavigate();

  const {
    activityId,
  } =
    useParams<{
      activityId: string;
    }>();

  const [
    teacherId,
    setTeacherId,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState<ActivityForm>({
      title: "",
      description: "",
      topic:
        "Number Sense",
      grade:
        "Grade 1",
      difficulty:
        "easy",
      questionCount:
        "10",
    });

  const [
    originalSettings,
    setOriginalSettings,
  ] =
    useState<OriginalGeneratorSettings | null>(
      null
    );

  const [
    errors,
    setErrors,
  ] =
    useState<FormErrors>(
      {}
    );

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

  const range =
    useMemo(
      () =>
        DIFFICULTY_RANGES[
          form.difficulty
        ],
      [
        form.difficulty,
      ]
    );

  /*
   * =========================
   * LOAD ACTIVITY
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

          setTeacherId(
            user.uid
          );

          try {
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

            const difficulty:
              Difficulty =
              data.difficulty ===
              "average"
                ? "average"
                : data.difficulty ===
                    "difficult"
                  ? "difficult"
                  : "easy";

            const topic:
              Topic =
              data.topic ===
              "Addition"
                ? "Addition"
                : data.topic ===
                    "Subtraction"
                  ? "Subtraction"
                  : "Number Sense";

            const difficultyRange =
              DIFFICULTY_RANGES[
                difficulty
              ];

            const questionCount =
              Number(
                data.questionCount ??
                  10
              );

            setForm({
              title:
                data.title ??
                "",

              description:
                data.description ??
                "",

              topic,

              grade:
                data.grade ===
                "Grade 2"
                  ? "Grade 2"
                  : "Grade 1",

              difficulty,

              questionCount:
                String(
                  questionCount
                ),
            });

            setOriginalSettings({
              topic,

              grade:
                data.grade ===
                "Grade 2"
                  ? "Grade 2"
                  : "Grade 1",

              difficulty,

              minNumber:
                Number(
                  data.minNumber ??
                    difficultyRange.min
                ),

              maxNumber:
                Number(
                  data.maxNumber ??
                    difficultyRange.max
                ),

              questionCount,
            });

            setLoading(
              false
            );
          } catch (
            loadError
          ) {
            console.error(
              "Could not load activity:",
              loadError
            );

            setError(
              "Could not load activity."
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
   * INPUT
   * =========================
   */

  const updateField = <
    K extends keyof ActivityForm
  >(
    field: K,
    value:
      ActivityForm[K]
  ) => {
    setForm(
      (
        current
      ) => ({
        ...current,

        [field]:
          value,
      })
    );

    setErrors(
      (
        current
      ) => ({
        ...current,

        [field]:
          undefined,
      })
    );

    setError(
      ""
    );
  };

  /*
   * =========================
   * VALIDATION
   * =========================
   */

  const validate =
    (): boolean => {
      const nextErrors:
        FormErrors = {};

      const title =
        form.title.trim();

      const questionCount =
        Number(
          form.questionCount
        );

      if (!title) {
        nextErrors.title =
          "Activity title is required.";
      } else if (
        title.length >
        100
      ) {
        nextErrors.title =
          "Activity title must be 100 characters or less.";
      }

      if (
        !Number.isInteger(
          questionCount
        ) ||
        questionCount <
          1 ||
        questionCount >
          100
      ) {
        nextErrors.questionCount =
          "Question count must be from 1 to 100.";
      }

      setErrors(
        nextErrors
      );

      return (
        Object.keys(
          nextErrors
        ).length ===
        0
      );
    };

  /*
   * =========================
   * SAVE
   * =========================
   */

  const handleSave =
    async () => {
      if (
        !activityId ||
        !teacherId ||
        !originalSettings ||
        !validate()
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (
        !user ||
        user.uid !==
          teacherId
      ) {
        navigate("/");

        return;
      }

      const questionCount =
        Number(
          form.questionCount
        );

      const generatorSettingsChanged =
        originalSettings.topic !==
          form.topic ||
        originalSettings.grade !==
          form.grade ||
        originalSettings.difficulty !==
          form.difficulty ||
        originalSettings.minNumber !==
          range.min ||
        originalSettings.maxNumber !==
          range.max ||
        originalSettings.questionCount !==
          questionCount;

      try {
        setSaving(
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

        if (
          generatorSettingsChanged
        ) {
          await updateDoc(
            reference,
            {
              title:
                form.title.trim(),

              description:
                form.description.trim(),

              topic:
                form.topic,

              grade:
                form.grade,

              difficulty:
                form.difficulty,

              minNumber:
                range.min,

              maxNumber:
                range.max,

              questionCount,

              /*
               * Existing generated
               * questions are no longer
               * guaranteed to match the
               * edited settings.
               */
              savedQuestions:
                [],

              assignmentRevision:
                increment(
                  1
                ),

              updatedAt:
                serverTimestamp(),
            }
          );
        } else {
          await updateDoc(
            reference,
            {
              title:
                form.title.trim(),

              description:
                form.description.trim(),

              updatedAt:
                serverTimestamp(),
            }
          );
        }

        navigate(
          `/teacher/activities/${activityId}`
        );
      } catch (
        saveError
      ) {
        console.error(
          "Could not update activity:",
          saveError
        );

        setError(
          saveError instanceof
          Error
            ? saveError.message
            : "Could not update activity."
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

        <div className="teacher-edit-activity-loading">
          Loading activity...
        </div>

      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>

      <div className="teacher-edit-activity-heading">

        <button
          type="button"
          className="teacher-edit-activity-back"
          onClick={() =>
            navigate(
              `/teacher/activities/${activityId}`
            )
          }
        >
          ← Activity Details
        </button>

        <span className="teacher-edit-activity-eyebrow">
          ACTIVITY MANAGEMENT
        </span>

        <h2>
          Edit Activity
        </h2>

        <p>
          Update the activity information
          and learning settings.
        </p>

      </div>

      {error && (
        <div
          className="teacher-edit-activity-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!error &&
        originalSettings && (
          <section className="teacher-edit-activity-card">

            <div className="teacher-edit-activity-section-heading">

              <span>
                ACTIVITY INFORMATION
              </span>

              <h3>
                Edit Details
              </h3>

            </div>

            <div className="teacher-edit-activity-grid">

              {/* TITLE */}

              <div className="teacher-edit-activity-field full">

                <label htmlFor="edit-activity-title">
                  ACTIVITY TITLE
                </label>

                <input
                  id="edit-activity-title"
                  type="text"
                  maxLength={
                    100
                  }
                  value={
                    form.title
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "title",
                      event.target.value
                    )
                  }
                />

                <div className="teacher-edit-activity-field-footer">

                  {errors.title ? (
                    <small className="error">
                      {
                        errors.title
                      }
                    </small>
                  ) : (
                    <small>
                      Use a clear name for
                      teachers and learners.
                    </small>
                  )}

                  <small>
                    {
                      form.title.length
                    }
                    /100
                  </small>

                </div>

              </div>

              {/* DESCRIPTION */}

              <div className="teacher-edit-activity-field full">

                <label htmlFor="edit-activity-description">
                  DESCRIPTION
                  <span>
                    OPTIONAL
                  </span>
                </label>

                <textarea
                  id="edit-activity-description"
                  maxLength={
                    255
                  }
                  value={
                    form.description
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "description",
                      event.target.value
                    )
                  }
                />

                <div className="teacher-edit-activity-field-footer">

                  <small>
                    Briefly describe what
                    learners will practice.
                  </small>

                  <small>
                    {
                      form.description.length
                    }
                    /255
                  </small>

                </div>

              </div>

              {/* TOPIC */}

              <div className="teacher-edit-activity-field">

                <label htmlFor="edit-activity-topic">
                  TOPIC
                </label>

                <select
                  id="edit-activity-topic"
                  value={
                    form.topic
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "topic",
                      event.target.value as
                        Topic
                    )
                  }
                >
                  <option value="Number Sense">
                    Number Sense
                  </option>

                  <option value="Addition">
                    Addition
                  </option>

                  <option value="Subtraction">
                    Subtraction
                  </option>
                </select>

              </div>

              {/* GRADE */}

              <div className="teacher-edit-activity-field">

                <label htmlFor="edit-activity-grade">
                  GRADE LEVEL
                </label>

                <select
                  id="edit-activity-grade"
                  value={
                    form.grade
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "grade",
                      event.target.value
                    )
                  }
                >
                  <option value="Grade 1">
                    Grade 1
                  </option>

                  <option value="Grade 2">
                    Grade 2
                  </option>
                </select>

              </div>

              {/* DIFFICULTY */}

              <div className="teacher-edit-activity-field">

                <label htmlFor="edit-activity-difficulty">
                  DIFFICULTY
                </label>

                <select
                  id="edit-activity-difficulty"
                  value={
                    form.difficulty
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "difficulty",
                      event.target.value as
                        Difficulty
                    )
                  }
                >
                  <option value="easy">
                    Easy
                  </option>

                  <option value="average">
                    Average
                  </option>

                  <option value="difficult">
                    Difficult
                  </option>
                </select>

              </div>

              {/* QUESTIONS */}

              <div className="teacher-edit-activity-field">

                <label htmlFor="edit-activity-question-count">
                  NUMBER OF QUESTIONS
                </label>

                <input
                  id="edit-activity-question-count"
                  type="number"
                  min="1"
                  max="100"
                  value={
                    form.questionCount
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "questionCount",
                      event.target.value
                    )
                  }
                />

                {errors.questionCount ? (
                  <small className="error">
                    {
                      errors.questionCount
                    }
                  </small>
                ) : (
                  <small>
                    1–100 questions
                  </small>
                )}

              </div>

            </div>

            {/* RANGE */}

            <div className="teacher-edit-activity-range">

              <div>

                <span>
                  NUMBER RANGE
                </span>

                <strong>
                  {range.min}–
                  {range.max}
                </strong>

              </div>

              <p>
                {difficultyLabel(
                  form.difficulty
                )}{" "}
                activities use numbers
                from{" "}
                <strong>
                  {range.min}
                </strong>{" "}
                to{" "}
                <strong>
                  {range.max}
                </strong>
                .
              </p>

            </div>

            {/* WARNING */}

            <div className="teacher-edit-activity-notice">

              <strong>
                Question settings
              </strong>

              <p>
                Changing the topic,
                grade, difficulty, number
                range, or question count
                will clear previously
                saved generated questions
                so they can be regenerated
                using the new settings.
              </p>

            </div>

            {/* SUMMARY */}

            <div className="teacher-edit-activity-summary">

              <span>
                UPDATED ACTIVITY
              </span>

              <div className="teacher-edit-activity-summary-grid">

                <div>
                  <small>
                    TOPIC
                  </small>

                  <strong>
                    {
                      form.topic
                    }
                  </strong>
                </div>

                <div>
                  <small>
                    GRADE
                  </small>

                  <strong>
                    {
                      form.grade
                    }
                  </strong>
                </div>

                <div>
                  <small>
                    DIFFICULTY
                  </small>

                  <strong>
                    {difficultyLabel(
                      form.difficulty
                    )}
                  </strong>
                </div>

                <div>
                  <small>
                    RANGE
                  </small>

                  <strong>
                    {range.min}–
                    {range.max}
                  </strong>
                </div>

                <div>
                  <small>
                    QUESTIONS
                  </small>

                  <strong>
                    {form.questionCount ||
                      "—"}
                  </strong>
                </div>

              </div>

            </div>

            {/* ACTIONS */}

            <div className="teacher-edit-activity-actions">

              <button
                type="button"
                className="teacher-edit-activity-cancel"
                disabled={
                  saving
                }
                onClick={() =>
                  navigate(
                    `/teacher/activities/${activityId}`
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="teacher-edit-activity-save"
                disabled={
                  saving
                }
                onClick={() => {
                  void handleSave();
                }}
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </section>
        )}

    </TeacherLayout>
  );
}

export default TeacherEditActivityPage;