import {
  useEffect,
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

import "./TeacherCreateLearnerPage.css";

interface LearnerForm {
  firstName: string;
  lastName: string;

  grade: string;
  section: string;

  age: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;

  grade?: string;
  section?: string;

  age?: string;
}

function TeacherCreateLearnerPage() {
  const navigate =
    useNavigate();

  const [
    teacherId,
    setTeacherId,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState<LearnerForm>({
      firstName: "",
      lastName: "",

      grade: "",
      section: "",

      age: "",
    });

  const [
    errors,
    setErrors,
  ] =
    useState<FormErrors>(
      {}
    );

  const [
    loadingAuth,
    setLoadingAuth,
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

  /*
   * =========================
   * AUTH
   * =========================
   */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (
          user
        ) => {
          if (!user) {
            navigate("/");

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
  }, [
    navigate,
  ]);

  /*
   * =========================
   * INPUT
   * =========================
   */

  const handleChange = (
    field:
      keyof LearnerForm,
    value: string
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

      const firstName =
        form.firstName.trim();

      const lastName =
        form.lastName.trim();

      const grade =
        form.grade.trim();

      const section =
        form.section.trim();

      const age =
        Number(
          form.age
        );

      if (!firstName) {
        nextErrors.firstName =
          "First name is required.";
      }

      if (!lastName) {
        nextErrors.lastName =
          "Last name is required.";
      }

      if (!grade) {
        nextErrors.grade =
          "Grade is required.";
      }

      if (!section) {
        nextErrors.section =
          "Section is required.";
      }

      if (
        !Number.isInteger(
          age
        ) ||
        age < 3 ||
        age > 25
      ) {
        nextErrors.age =
          "Enter a valid age from 3 to 25.";
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

        await addDoc(
          collection(
            db,
            "learners"
          ),
          {
            teacherId:
              user.uid,

            firstName:
              form.firstName.trim(),

            lastName:
              form.lastName.trim(),

            grade:
              form.grade.trim(),

            section:
              form.section.trim(),

            age:
              Number(
                form.age
              ),

            status:
              "active",

            rfidUid:
              null,

            guardianIds:
              [],

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        navigate(
          "/teacher/learners"
        );
      } catch (
        saveError
      ) {
        console.error(
          "Could not create learner:",
          saveError
        );

        setError(
          saveError instanceof
          Error
            ? saveError.message
            : "Could not create learner."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /*
   * =========================
   * LOADING
   * =========================
   */

  if (
    loadingAuth
  ) {
    return (
      <TeacherLayout>

        <div className="teacher-create-learner-loading">
          Loading...
        </div>

      </TeacherLayout>
    );
  }

  /*
   * =========================
   * UI
   * =========================
   */

  return (
    <TeacherLayout>

      <div className="teacher-create-learner-heading">

        <button
          type="button"
          className="teacher-create-learner-back"
          onClick={() =>
            navigate(
              "/teacher/learners"
            )
          }
        >
          ← My Learners
        </button>

        <span className="teacher-create-learner-eyebrow">
          LEARNER MANAGEMENT
        </span>

        <h2>
          Create Learner
        </h2>

        <p>
          Add a learner to your
          Mathalino teacher account.
        </p>

      </div>

      {error && (
        <div
          className="teacher-create-learner-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="teacher-create-learner-card">

        <div className="teacher-create-learner-section-heading">

          <span>
            LEARNER INFORMATION
          </span>

          <h3>
            Learner Profile
          </h3>

          <p>
            Enter the learner's basic
            classroom information.
          </p>

        </div>

        <div className="teacher-create-learner-grid">

          {/* FIRST NAME */}

          <div className="teacher-create-learner-field">

            <label htmlFor="learner-first-name">
              FIRST NAME
            </label>

            <input
              id="learner-first-name"
              type="text"
              autoComplete="off"
              placeholder="First name"
              value={
                form.firstName
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "firstName",
                  event.target.value
                )
              }
            />

            {errors.firstName && (
              <small className="error">
                {
                  errors.firstName
                }
              </small>
            )}

          </div>

          {/* LAST NAME */}

          <div className="teacher-create-learner-field">

            <label htmlFor="learner-last-name">
              LAST NAME
            </label>

            <input
              id="learner-last-name"
              type="text"
              autoComplete="off"
              placeholder="Last name"
              value={
                form.lastName
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "lastName",
                  event.target.value
                )
              }
            />

            {errors.lastName && (
              <small className="error">
                {
                  errors.lastName
                }
              </small>
            )}

          </div>

          {/* GRADE */}

          <div className="teacher-create-learner-field">

            <label htmlFor="learner-grade">
              GRADE
            </label>

            <input
              id="learner-grade"
              type="text"
              autoComplete="off"
              placeholder="Example: 1"
              value={
                form.grade
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "grade",
                  event.target.value
                )
              }
            />

            {errors.grade ? (
              <small className="error">
                {
                  errors.grade
                }
              </small>
            ) : (
              <small>
                Example: 1 or 2
              </small>
            )}

          </div>

          {/* SECTION */}

          <div className="teacher-create-learner-field">

            <label htmlFor="learner-section">
              SECTION
            </label>

            <input
              id="learner-section"
              type="text"
              autoComplete="off"
              placeholder="Example: A"
              value={
                form.section
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "section",
                  event.target.value
                )
              }
            />

            {errors.section && (
              <small className="error">
                {
                  errors.section
                }
              </small>
            )}

          </div>

          {/* AGE */}

          <div className="teacher-create-learner-field full">

            <label htmlFor="learner-age">
              AGE
            </label>

            <input
              id="learner-age"
              type="number"
              min="3"
              max="25"
              placeholder="Age"
              value={
                form.age
              }
              disabled={
                saving
              }
              onChange={(
                event
              ) =>
                handleChange(
                  "age",
                  event.target.value
                )
              }
            />

            {errors.age ? (
              <small className="error">
                {
                  errors.age
                }
              </small>
            ) : (
              <small>
                Valid age: 3–25
              </small>
            )}

          </div>

        </div>

        {/* INITIAL SETTINGS */}

        <div className="teacher-create-learner-initial">

          <span>
            INITIAL LEARNER SETTINGS
          </span>

          <div className="teacher-create-learner-initial-grid">

            <div>

              <small>
                STATUS
              </small>

              <strong>
                Active
              </strong>

            </div>

            <div>

              <small>
                RFID CARD
              </small>

              <strong>
                Not linked
              </strong>

            </div>

            <div>

              <small>
                GUARDIAN ACCESS
              </small>

              <strong>
                None
              </strong>

            </div>

          </div>

          <p>
            After creating the learner,
            you can link an RFID card,
            generate a guardian
            invitation code, and assign
            activities from the learner's
            profile.
          </p>

        </div>

        {/* ACTIONS */}

        <div className="teacher-create-learner-actions">

          <button
            type="button"
            className="teacher-create-learner-cancel"
            disabled={
              saving
            }
            onClick={() =>
              navigate(
                "/teacher/learners"
              )
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="teacher-create-learner-save"
            disabled={
              saving
            }
            onClick={() => {
              void handleSave();
            }}
          >
            {saving
              ? "Saving..."
              : "Save Learner"}
          </button>

        </div>

      </section>

    </TeacherLayout>
  );
}

export default TeacherCreateLearnerPage;