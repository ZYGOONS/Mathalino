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
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherCreateActivityPage.css";

type Topic =
  | "Number Sense"
  | "Addition"
  | "Subtraction";

type Difficulty =
  | "easy"
  | "average"
  | "difficult";

type QuestionSource =
  | "generated"
  | "teacher-made";

interface ActivityForm {
  title: string;

  description: string;

  topic: Topic;

  grade: string;

  difficulty: Difficulty;

  questionCount: string;

  questionSource:
    QuestionSource;
}

interface FormErrors {
  title?: string;

  topic?: string;

  grade?: string;

  difficulty?: string;

  questionCount?: string;

  questionSource?: string;
}

interface DifficultyRange {
  min: number;

  max: number;
}

const DIFFICULTY_RANGES: Record<
  Difficulty,
  DifficultyRange
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
  difficulty:
    Difficulty
): string {
  switch (
    difficulty
  ) {
    case "easy":
      return "Easy";

    case "average":
      return "Average";

    case "difficult":
      return "Difficult";
  }
}

function TeacherCreateActivityPage() {
  const navigate =
    useNavigate();

  const [
    teacherId,
    setTeacherId,
  ] =
    useState("");

  const [
    loadingAuth,
    setLoadingAuth,
  ] =
    useState(
      true
    );

  const [
    form,
    setForm,
  ] =
    useState<ActivityForm>({
      title:
        "",

      description:
        "",

      topic:
        "Number Sense",

      grade:
        "Grade 1",

      difficulty:
        "easy",

      questionCount:
        "10",

      questionSource:
        "generated",
    });

  const [
    errors,
    setErrors,
  ] =
    useState<FormErrors>(
      {}
    );

  const [
    saving,
    setSaving,
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

  useEffect(
    () => {
      const unsubscribe =
        onAuthStateChanged(
          auth,
          (
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

            setTeacherId(
              user.uid
            );

            setLoadingAuth(
              false
            );
          }
        );

      return () => {
        unsubscribe();
      };
    },
    [
      navigate,
    ]
  );

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

      if (
        !title
      ) {
        nextErrors.title =
          "Activity title is required.";
      }

      if (
        title.length >
        100
      ) {
        nextErrors.title =
          "Activity title must be 100 characters or less.";
      }

      if (
        !form.topic
      ) {
        nextErrors.topic =
          "Select a topic.";
      }

      if (
        !form.grade
      ) {
        nextErrors.grade =
          "Select a grade.";
      }

      if (
        !form.difficulty
      ) {
        nextErrors.difficulty =
          "Select a difficulty.";
      }

      if (
        !form.questionSource
      ) {
        nextErrors.questionSource =
          "Select a question source.";
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

  const handleCreate =
    async () => {
      if (
        !teacherId ||
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

        const questionCount =
          Number(
            form.questionCount
          );

        const activityReference =
          await addDoc(
            collection(
              db,
              "activities"
            ),
            {
              teacherId:
                user.uid,

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

              questionSource:
                form.questionSource,

              savedQuestions:
                [],

              status:
                "active",

              libraryVisible:
                true,

              trashed:
                false,

              assignmentRevision:
                0,

              createdAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),
            }
          );

        navigate(
          `/teacher/activities/${activityReference.id}/questions`
        );
      } catch (
        createError
      ) {
        console.error(
          "Could not create activity:",
          createError
        );

        setError(
          createError instanceof
          Error
            ? createError.message
            : "Could not create activity."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  if (
    loadingAuth
  ) {
    return (
      <TeacherLayout>

        <div className="teacher-create-activity-loading">
          Loading...
        </div>

      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>

      <div className="teacher-create-activity-heading">

        <button
          type="button"
          className="teacher-create-activity-back"
          onClick={() =>
            navigate(
              "/teacher/activities"
            )
          }
        >
          ← Activities
        </button>

        <span className="teacher-create-activity-eyebrow">
          ACTIVITY MANAGEMENT
        </span>

        <h2>
          Create Activity
        </h2>

        <p>
          Create a mathematics activity
          for your learners.
        </p>

      </div>

      {error && (
        <div
          className="teacher-create-activity-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="teacher-create-activity-card">

        <div className="teacher-create-activity-section-heading">

          <span>
            ACTIVITY INFORMATION
          </span>

          <h3>
            Activity Details
          </h3>

        </div>

        <div className="teacher-create-activity-grid">

          <div className="teacher-create-activity-field full">

            <label htmlFor="activity-title">
              ACTIVITY TITLE
            </label>

            <input
              id="activity-title"
              type="text"
              maxLength={
                100
              }
              placeholder="Example: Addition within 10"
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

            <div className="teacher-create-activity-field-footer">

              {errors.title ? (
                <small className="error">
                  {
                    errors.title
                  }
                </small>
              ) : (
                <small>
                  Give the activity a clear learner-friendly name.
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

          <div className="teacher-create-activity-field full">

            <label htmlFor="activity-description">
              DESCRIPTION
              <span>
                OPTIONAL
              </span>
            </label>

            <textarea
              id="activity-description"
              maxLength={
                255
              }
              placeholder="Short description of the activity."
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

            <div className="teacher-create-activity-field-footer">

              <small>
                Briefly describe what learners will practice.
              </small>

              <small>
                {
                  form.description.length
                }
                /255
              </small>

            </div>

          </div>

          <div className="teacher-create-activity-field">

            <label htmlFor="activity-topic">
              TOPIC
            </label>

            <select
              id="activity-topic"
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

            {errors.topic && (
              <small className="error">
                {
                  errors.topic
                }
              </small>
            )}

          </div>

          <div className="teacher-create-activity-field">

            <label htmlFor="activity-grade">
              GRADE LEVEL
            </label>

            <select
              id="activity-grade"
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

            {errors.grade && (
              <small className="error">
                {
                  errors.grade
                }
              </small>
            )}

          </div>

          <div className="teacher-create-activity-field">

            <label htmlFor="activity-difficulty">
              DIFFICULTY
            </label>

            <select
              id="activity-difficulty"
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

          <div className="teacher-create-activity-field">

            <label htmlFor="activity-question-count">
              NUMBER OF QUESTIONS
            </label>

            <input
              id="activity-question-count"
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

        <div className="teacher-create-source-section">

          <div className="teacher-create-source-heading">

            <span>
              QUESTION SOURCE
            </span>

            <h3>
              How should the questions be created?
            </h3>

            <p>
              Choose automatic question generation or create the question set yourself.
            </p>

          </div>

          <div className="teacher-create-source-options">

            <button
              type="button"
              className={
                form.questionSource ===
                "generated"
                  ? "teacher-create-source-card active"
                  : "teacher-create-source-card"
              }
              disabled={
                saving
              }
              onClick={() =>
                updateField(
                  "questionSource",
                  "generated"
                )
              }
            >

              <span className="teacher-create-source-icon">
                ✦
              </span>

              <div>

                <strong>
                  Generated
                </strong>

                <p>
                  Mathalino automatically creates questions based on the selected topic, difficulty and number range.
                </p>

              </div>

              <span className="teacher-create-source-check">
                {
                  form.questionSource ===
                  "generated"
                    ? "✓"
                    : ""
                }
              </span>

            </button>

            <button
              type="button"
              className={
                form.questionSource ===
                "teacher-made"
                  ? "teacher-create-source-card active"
                  : "teacher-create-source-card"
              }
              disabled={
                saving
              }
              onClick={() =>
                updateField(
                  "questionSource",
                  "teacher-made"
                )
              }
            >

              <span className="teacher-create-source-icon">
                ✎
              </span>

              <div>

                <strong>
                  Teacher-made
                </strong>

                <p>
                  Enter the numbers and question types manually before saving the final activity question set.
                </p>

              </div>

              <span className="teacher-create-source-check">
                {
                  form.questionSource ===
                  "teacher-made"
                    ? "✓"
                    : ""
                }
              </span>

            </button>

          </div>

          {errors.questionSource && (
            <small className="teacher-create-source-error">
              {
                errors.questionSource
              }
            </small>
          )}

        </div>

        <div className="teacher-create-activity-range">

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
            activities use numbers from{" "}
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

        <div className="teacher-create-activity-summary">

          <span>
            ACTIVITY SUMMARY
          </span>

          <div className="teacher-create-activity-summary-grid">

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

            <div>

              <small>
                SOURCE
              </small>

              <strong>
                {form.questionSource ===
                "generated"
                  ? "Generated"
                  : "Teacher-made"}
              </strong>

            </div>

          </div>

        </div>

        <div className="teacher-create-activity-actions">

          <button
            type="button"
            className="teacher-create-activity-cancel"
            disabled={
              saving
            }
            onClick={() =>
              navigate(
                "/teacher/activities"
              )
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="teacher-create-activity-save"
            disabled={
              saving
            }
            onClick={() => {
              void handleCreate();
            }}
          >
            {saving
              ? "Creating..."
              : "Continue to Questions"}
          </button>

        </div>

      </section>

    </TeacherLayout>
  );
}

export default TeacherCreateActivityPage;