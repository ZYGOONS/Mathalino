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
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherLearnerDetailsPage.css";

interface Learner {
  id: string;

  teacherId: string;

  firstName: string;
  lastName: string;

  grade: string;
  section: string;

  age: number;

  status: string;

  rfidUid:
    | string
    | null;

  createdAt:
    | Timestamp
    | null;
}

function TeacherLearnerDetailsPage() {
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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    updatingStatus,
    setUpdatingStatus,
  ] =
    useState(false);

  useEffect(() => {
    if (!learnerId) {
      navigate(
        "/teacher/learners"
      );

      return;
    }

    let unsubscribeLearner:
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

          unsubscribeLearner =
            onSnapshot(
              doc(
                db,
                "learners",
                learnerId
              ),
              (
                snapshot
              ) => {
                if (
                  !snapshot.exists()
                ) {
                  setError(
                    "Learner was not found."
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
                    "This learner is not assigned to your account."
                  );

                  setLoading(
                    false
                  );

                  return;
                }

                setLearner({
                  id:
                    snapshot.id,

                  teacherId:
                    data.teacherId ??
                    "",

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
                    Number(
                      data.age ??
                        0
                    ),

                  status:
                    data.status ??
                    "active",

                  rfidUid:
                    data.rfidUid ??
                    null,

                  createdAt:
                    data.createdAt ??
                    null,
                });

                setError("");

                setLoading(
                  false
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      unsubscribeLearner?.();
    };
  }, [
    learnerId,
    navigate,
  ]);

  const handleStatusChange =
    async () => {
      if (
        !learner ||
        !learnerId
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (!user) {
        navigate("/");
        return;
      }

      const nextStatus =
        learner.status ===
        "active"
          ? "inactive"
          : "active";

      try {
        setUpdatingStatus(
          true
        );

        await updateDoc(
          doc(
            db,
            "learners",
            learnerId
          ),
          {
            status:
              nextStatus,

            updatedAt:
              serverTimestamp(),
          }
        );
      } catch (
        statusError
      ) {
        console.error(
          statusError
        );

        setError(
          "Could not update learner status."
        );
      } finally {
        setUpdatingStatus(
          false
        );
      }
    };

  const fullName =
    learner
      ? [
          learner.firstName,
          learner.lastName,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  return (
    <TeacherLayout>

      <div className="teacher-learner-detail-heading">

        <button
          type="button"
          className="teacher-learner-back"
          onClick={() =>
            navigate(
              "/teacher/learners"
            )
          }
        >
          ← My Learners
        </button>

        <span className="teacher-learner-detail-eyebrow">
          LEARNER MANAGEMENT
        </span>

        <h2>
          Learner Details
        </h2>

        <p>
          View and manage this
          learner's Mathalino profile.
        </p>

      </div>

      {error && (
        <div className="teacher-learner-detail-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="teacher-learner-detail-loading">
          Loading learner...
        </div>
      )}

      {!loading &&
        learner && (
          <>

            <section className="teacher-learner-profile-card">

              <div className="teacher-learner-profile-top">

                <div className="teacher-learner-avatar">
                  {learner.firstName
                    .charAt(0)
                    .toUpperCase() ||
                    "L"}
                </div>

                <div>

                  <span className="teacher-learner-profile-label">
                    LEARNER
                  </span>

                  <h3>
                    {fullName}
                  </h3>

                  <p>
                    Grade{" "}
                    {learner.grade ||
                      "—"}{" "}
                    · Section{" "}
                    {learner.section ||
                      "—"}{" "}
                    · Age{" "}
                    {learner.age ||
                      "—"}
                  </p>

                </div>

                <span
                  className={
                    learner.status ===
                    "active"
                      ? "teacher-learner-status active"
                      : "teacher-learner-status inactive"
                  }
                >
                  {learner.status ===
                  "active"
                    ? "Active"
                    : "Inactive"}
                </span>

              </div>

              <div className="teacher-learner-info-grid">

                <div>
                  <span>
                    FIRST NAME
                  </span>

                  <strong>
                    {learner.firstName}
                  </strong>
                </div>

                <div>
                  <span>
                    LAST NAME
                  </span>

                  <strong>
                    {learner.lastName}
                  </strong>
                </div>

                <div>
                  <span>
                    GRADE
                  </span>

                  <strong>
                    {learner.grade ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    SECTION
                  </span>

                  <strong>
                    {learner.section ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    AGE
                  </span>

                  <strong>
                    {learner.age ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    RFID CARD
                  </span>

                  <strong
                    className={
                      learner.rfidUid
                        ? "teacher-learner-rfid linked"
                        : "teacher-learner-rfid"
                    }
                  >
                    {learner.rfidUid
                      ? "Linked"
                      : "Not linked"}
                  </strong>
                </div>

              </div>

            </section>

            <section className="teacher-learner-actions-card">

              <div className="teacher-learner-actions-heading">

                <span>
                  LEARNER ACTIONS
                </span>

                <h3>
                  Manage Learner
                </h3>

              </div>

              <div className="teacher-learner-actions-grid">

                <button
                  type="button"
                  className="teacher-learner-action primary"
                  onClick={() =>
                    navigate(
                      `/teacher/learners/${learner.id}/assignments`
                    )
                  }
                >
                  <strong>
                    Assigned Activities
                  </strong>

                  <span>
                    View or assign the
                    learner's activity.
                  </span>
                </button>

                <button
                  type="button"
                  className="teacher-learner-action"
                  onClick={() =>
                    navigate(
                      `/teacher/learners/${learner.id}/edit`
                    )
                  }
                >
                  <strong>
                    Edit Learner
                  </strong>

                  <span>
                    Update learner profile
                    information.
                  </span>
                </button>

                <button
                  type="button"
                  className="teacher-learner-action"
                  onClick={() =>
                    navigate(
                      `/teacher/learners/${learner.id}/rfid`
                    )
                  }
                >
                  <strong>
                    Link RFID Card
                  </strong>

                  <span>
                    {learner.rfidUid
                      ? "Replace or relink this learner's RFID card."
                      : "Connect this learner to a physical RFID card."}
                  </span>
                </button>

                <button
                  type="button"
                  className="teacher-learner-action"
                  onClick={() =>
                    navigate(
                      `/teacher/learners/${learner.id}/invitation`
                    )
                  }
                >
                  <strong>
                    Invitation Code
                  </strong>

                  <span>
                    Generate a guardian
                    invitation code.
                  </span>
                </button>

                <button
                  type="button"
                  className="teacher-learner-action"
                  onClick={() =>
                    navigate(
                      `/teacher/learners/${learner.id}/performance`
                    )
                  }
                >
                  <strong>
                    View Performance
                  </strong>

                  <span>
                    Review mastery,
                    completed activities,
                    and recommendations.
                  </span>
                </button>

              </div>

              <div className="teacher-learner-status-action">

                <div>

                  <strong>
                    {learner.status ===
                    "active"
                      ? "Deactivate learner"
                      : "Activate learner"}
                  </strong>

                  <p>
                    This changes the
                    learner's availability
                    in Mathalino.
                  </p>

                </div>

                <button
                  type="button"
                  className={
                    learner.status ===
                    "active"
                      ? "teacher-learner-deactivate"
                      : "teacher-learner-activate"
                  }
                  disabled={
                    updatingStatus
                  }
                  onClick={() => {
                    void handleStatusChange();
                  }}
                >
                  {updatingStatus
                    ? "Updating..."
                    : learner.status ===
                        "active"
                      ? "Deactivate"
                      : "Activate"}
                </button>

              </div>

            </section>

          </>
        )}

    </TeacherLayout>
  );
}

export default TeacherLearnerDetailsPage;