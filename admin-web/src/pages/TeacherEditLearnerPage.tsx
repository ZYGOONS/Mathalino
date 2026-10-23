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
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherEditLearnerPage.css";

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

function TeacherEditLearnerPage() {
  const navigate =
    useNavigate();

  const {
    learnerId,
  } =
    useParams<{
      learnerId: string;
    }>();

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

  /*
   * =========================
   * LOAD LEARNER
   * =========================
   */

  useEffect(() => {
    if (!learnerId) {
      navigate(
        "/teacher/learners"
      );

      return;
    }

    let active =
      true;

    const loadLearner =
      async (
        teacherId: string
      ) => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          const learnerReference =
            doc(
              db,
              "learners",
              learnerId
            );

          const snapshot =
            await getDoc(
              learnerReference
            );

          if (
            !snapshot.exists()
          ) {
            throw new Error(
              "Learner was not found."
            );
          }

          const data =
            snapshot.data();

          if (
            data.teacherId !==
            teacherId
          ) {
            throw new Error(
              "This learner does not belong to your account."
            );
          }

          if (!active) {
            return;
          }

          setForm({
            firstName:
              data.firstName ??
              "",

            lastName:
              data.lastName ??
              "",

            grade:
              data.grade ??
              "",

            section:
              data.section ??
              "",

            age:
              String(
                data.age ??
                  ""
              ),
          });
        } catch (
          loadError
        ) {
          console.error(
            "Could not load learner:",
            loadError
          );

          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Could not load learner."
            );
          }
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      };

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (
          user
        ) => {
          if (!user) {
            navigate(
              "/"
            );

            return;
          }

          void loadLearner(
            user.uid
          );
        }
      );

    return () => {
      active =
        false;

      unsubscribe();
    };
  }, [
    learnerId,
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
          "Required";
      }

      if (!lastName) {
        nextErrors.lastName =
          "Required";
      }

      if (!grade) {
        nextErrors.grade =
          "Required";
      }

      if (!section) {
        nextErrors.section =
          "Required";
      }

      if (
        !Number.isInteger(
          age
        ) ||
        age < 3 ||
        age > 25
      ) {
        nextErrors.age =
          "Enter a valid age from 3 to 25";
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
   * SAVE CHANGES
   * =========================
   */

  const handleSave =
    async () => {
      if (
        !learnerId ||
        !validate()
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (!user) {
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

        const learnerReference =
          doc(
            db,
            "learners",
            learnerId
          );

        /*
         * Re-read ownership before
         * updating.
         */

        const currentLearner =
          await getDoc(
            learnerReference
          );

        if (
          !currentLearner.exists()
        ) {
          throw new Error(
            "Learner was not found."
          );
        }

        if (
          currentLearner.data()
            .teacherId !==
          user.uid
        ) {
          throw new Error(
            "This learner does not belong to your account."
          );
        }

        await updateDoc(
          learnerReference,
          {
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

            updatedAt:
              serverTimestamp(),
          }
        );

        navigate(
          `/teacher/learners/${learnerId}`
        );
      } catch (
        saveError
      ) {
        console.error(
          "Could not update learner:",
          saveError
        );

        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not update learner."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  return (
    <TeacherLayout>

      <div className="teacher-edit-learner-heading">

        <button
          type="button"
          className="teacher-edit-learner-back"
          onClick={() =>
            navigate(
              `/teacher/learners/${learnerId}`
            )
          }
        >
          ← Learner Details
        </button>

        <span className="teacher-edit-learner-eyebrow">
          LEARNER MANAGEMENT
        </span>

        <h2>
          Edit Learner
        </h2>

        <p>
          Update this learner's
          profile information.
        </p>

      </div>

      {error && (
        <div
          className="teacher-edit-learner-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="teacher-edit-learner-loading">
          Loading learner...
        </div>
      )}

      {!loading &&
        !error && (
          <section className="teacher-edit-learner-card">

            <div className="teacher-edit-learner-section-title">

              <span>
                PERSONAL INFORMATION
              </span>

              <h3>
                Learner Profile
              </h3>

            </div>

            <div className="teacher-edit-learner-grid">

              {/* FIRST NAME */}

              <div className="teacher-edit-learner-field">

                <label htmlFor="edit-learner-first-name">
                  FIRST NAME
                </label>

                <input
                  id="edit-learner-first-name"
                  type="text"
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
                  <small>
                    {
                      errors.firstName
                    }
                  </small>
                )}

              </div>

              {/* LAST NAME */}

              <div className="teacher-edit-learner-field">

                <label htmlFor="edit-learner-last-name">
                  LAST NAME
                </label>

                <input
                  id="edit-learner-last-name"
                  type="text"
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
                  <small>
                    {
                      errors.lastName
                    }
                  </small>
                )}

              </div>

              {/* GRADE */}

              <div className="teacher-edit-learner-field">

                <label htmlFor="edit-learner-grade">
                  GRADE
                </label>

                <input
                  id="edit-learner-grade"
                  type="text"
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

                {errors.grade && (
                  <small>
                    {
                      errors.grade
                    }
                  </small>
                )}

              </div>

              {/* SECTION */}

              <div className="teacher-edit-learner-field">

                <label htmlFor="edit-learner-section">
                  SECTION
                </label>

                <input
                  id="edit-learner-section"
                  type="text"
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
                  <small>
                    {
                      errors.section
                    }
                  </small>
                )}

              </div>

              {/* AGE */}

              <div className="teacher-edit-learner-field full">

                <label htmlFor="edit-learner-age">
                  AGE
                </label>

                <input
                  id="edit-learner-age"
                  type="number"
                  min="3"
                  max="25"
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

                {errors.age && (
                  <small>
                    {
                      errors.age
                    }
                  </small>
                )}

              </div>

            </div>

            <div className="teacher-edit-learner-actions">

              <button
                type="button"
                className="teacher-edit-learner-cancel"
                disabled={
                  saving
                }
                onClick={() =>
                  navigate(
                    `/teacher/learners/${learnerId}`
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="teacher-edit-learner-save"
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

export default TeacherEditLearnerPage;