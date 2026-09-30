import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router";

import {
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import mathalinoLogo from "../assets/mathalino-logo.png";

import "./TeacherAccountPage.css";

interface TeacherProfile {
  uid: string;
  email: string;
  role: string;

  firstName: string;
  middleInitial: string;
  lastName: string;

  title: string;
  school: string;

  createdAt: unknown;
}

function formatTimestamp(
  value: unknown
): string {
  if (!value) {
    return "—";
  }

  const timestamp =
    value as Timestamp;

  if (
    typeof timestamp?.toDate ===
    "function"
  ) {
    return timestamp
      .toDate()
      .toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );
  }

  return "—";
}

function TeacherAccountPage() {
  const navigate = useNavigate();

  const [profile, setProfile] =
    useState<TeacherProfile>({
      uid: "",
      email: "",
      role: "teacher",

      firstName: "",
      middleInitial: "",
      lastName: "",

      title: "",
      school: "",

      createdAt: null,
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadProfile = async (
      user: User
    ) => {
      try {
        setLoading(true);
        setError("");

        const userReference = doc(
          db,
          "users",
          user.uid
        );

        const userSnapshot =
          await getDoc(
            userReference
          );

        if (!userSnapshot.exists()) {
          throw new Error(
            "Teacher profile was not found."
          );
        }

        const data =
          userSnapshot.data();

        if (
          data.role !== "teacher"
        ) {
          throw new Error(
            "This account is not a teacher account."
          );
        }

        if (!active) {
          return;
        }

        setProfile({
          uid:
            user.uid,

          email:
            data.email ??
            user.email ??
            "",

          role:
            data.role ??
            "teacher",

          firstName:
            data.firstName ??
            "",

          middleInitial:
            data.middleInitial ??
            "",

          lastName:
            data.lastName ??
            "",

          title:
            data.title ??
            "",

          school:
            data.school ??
            "",

          createdAt:
            data.createdAt ??
            null,
        });
      } catch (profileError) {
        console.error(
          "Unable to load teacher profile:",
          profileError
        );

        if (active) {
          setError(
            "Unable to load your account information."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            navigate("/");
            return;
          }

          void loadProfile(
            user
          );
        }
      );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  const handleInputChange = (
    field:
      | "firstName"
      | "middleInitial"
      | "lastName"
      | "title"
      | "school",
    value: string
  ) => {
    setProfile(
      (currentProfile) => ({
        ...currentProfile,
        [field]: value,
      })
    );

    setSuccess("");
  };

  const handleSave = async () => {
    const user =
      auth.currentUser;

    if (!user) {
      navigate("/");
      return;
    }

    if (
      !profile.firstName.trim() ||
      !profile.lastName.trim()
    ) {
      setError(
        "First name and last name are required."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const userReference = doc(
        db,
        "users",
        user.uid
      );

      const fullName = [
        profile.firstName.trim(),

        profile.middleInitial.trim(),

        profile.lastName.trim(),
      ]
        .filter(Boolean)
        .join(" ");

      await updateDoc(
        userReference,
        {
          firstName:
            profile.firstName.trim(),

          middleInitial:
            profile.middleInitial.trim(),

          lastName:
            profile.lastName.trim(),

          fullName,

          displayName:
            fullName,

          title:
            profile.title.trim(),

          school:
            profile.school.trim(),

          updatedAt:
            serverTimestamp(),
        }
      );

      setEditing(false);

      setSuccess(
        "Account information updated successfully."
      );
    } catch (saveError) {
      console.error(
        "Unable to update teacher profile:",
        saveError
      );

      setError(
        "Unable to update your account information."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout =
    async () => {
      try {
        await signOut(auth);

        navigate("/");
      } catch (logoutError) {
        console.error(
          "Teacher logout error:",
          logoutError
        );
      }
    };

  const fullName = [
    profile.firstName,
    profile.middleInitial,
    profile.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="teacher-account-page">

      <div className="teacher-account-layout">

        {/* SIDEBAR */}

        <aside className="teacher-account-sidebar">

          <div className="teacher-account-brand">

            <img
              src={mathalinoLogo}
              alt="Mathalino Logo"
              className="teacher-account-logo"
            />

            <div>
              <h1>
                Mathalino
              </h1>

              <p>
                LEARN BY DOING
              </p>
            </div>

          </div>

          <nav className="teacher-account-nav">

            <button
              type="button"
              className="teacher-account-nav-item"
              onClick={() =>
                navigate(
                  "/teacher-dashboard"
                )
              }
            >
              Dashboard
            </button>

            <button
              type="button"
              className="teacher-account-nav-item"
              onClick={() =>
                navigate(
                  "/teacher/learners"
                )
              }
            >
              My Learners
            </button>

            <button
              type="button"
              className="teacher-account-nav-item"
              onClick={() =>
                navigate(
                  "/teacher/activities"
                )
              }
            >
              Activities
            </button>

            <button
              type="button"
              className="teacher-account-nav-item"
              onClick={() =>
                navigate(
                  "/teacher/guardian-requests"
                )
              }
            >
              Guardian Requests
            </button>

            <button
              type="button"
              className="teacher-account-nav-item active"
              onClick={() =>
                navigate(
                  "/teacher/account"
                )
              }
            >
              Account
            </button>

          </nav>

          <button
            type="button"
            className="teacher-account-logout"
            onClick={() => {
              void handleLogout();
            }}
          >
            Log out
          </button>

        </aside>

        {/* MAIN */}

        <main className="teacher-account-main">

          <div className="teacher-account-heading">

            <div>
              <span className="teacher-account-eyebrow">
                TEACHER ACCOUNT
              </span>

              <h2>
                Account
              </h2>

              <p>
                View and update your
                Mathalino teacher information.
              </p>
            </div>

            {!loading && (
              <button
                type="button"
                className={
                  editing
                    ? "teacher-account-edit cancel"
                    : "teacher-account-edit"
                }
                onClick={() => {
                  setEditing(
                    (current) =>
                      !current
                  );

                  setError("");
                  setSuccess("");
                }}
              >
                {editing
                  ? "Cancel"
                  : "Edit Profile"}
              </button>
            )}

          </div>

          {loading && (
            <div className="teacher-account-card">
              <div className="teacher-account-message">
                Loading account...
              </div>
            </div>
          )}

          {!loading && error && (
            <div
              className="teacher-account-alert error"
              role="alert"
            >
              {error}
            </div>
          )}

          {!loading && success && (
            <div
              className="teacher-account-alert success"
              role="status"
            >
              {success}
            </div>
          )}

          {!loading && (
            <section className="teacher-account-card">

              <div className="teacher-account-profile">

                <div className="teacher-account-avatar">
                  {profile.firstName
                    .charAt(0)
                    .toUpperCase() ||
                    "T"}
                </div>

                <div>
                  <h3>
                    {fullName ||
                      "Teacher"}
                  </h3>

                  <p>
                    {profile.title ||
                      "Teacher"}
                  </p>
                </div>

              </div>

              <div className="teacher-account-section-title">
                <span>
                  PERSONAL INFORMATION
                </span>

                <h4>
                  Teacher Profile
                </h4>
              </div>

              <div className="teacher-account-grid">

                <div className="teacher-account-field">

                  <label htmlFor="teacher-first-name">
                    FIRST NAME
                  </label>

                  <input
                    id="teacher-first-name"
                    type="text"
                    value={
                      profile.firstName
                    }
                    disabled={
                      !editing
                    }
                    onChange={(event) =>
                      handleInputChange(
                        "firstName",
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="teacher-account-field">

                  <label htmlFor="teacher-middle-initial">
                    MIDDLE INITIAL
                  </label>

                  <input
                    id="teacher-middle-initial"
                    type="text"
                    maxLength={3}
                    value={
                      profile.middleInitial
                    }
                    disabled={
                      !editing
                    }
                    onChange={(event) =>
                      handleInputChange(
                        "middleInitial",
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="teacher-account-field">

                  <label htmlFor="teacher-last-name">
                    LAST NAME
                  </label>

                  <input
                    id="teacher-last-name"
                    type="text"
                    value={
                      profile.lastName
                    }
                    disabled={
                      !editing
                    }
                    onChange={(event) =>
                      handleInputChange(
                        "lastName",
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="teacher-account-field">

                  <label htmlFor="teacher-title">
                    TITLE
                  </label>

                  <input
                    id="teacher-title"
                    type="text"
                    value={
                      profile.title
                    }
                    disabled={
                      !editing
                    }
                    onChange={(event) =>
                      handleInputChange(
                        "title",
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="teacher-account-field full">

                  <label htmlFor="teacher-school">
                    SCHOOL
                  </label>

                  <input
                    id="teacher-school"
                    type="text"
                    value={
                      profile.school
                    }
                    disabled={
                      !editing
                    }
                    onChange={(event) =>
                      handleInputChange(
                        "school",
                        event.target.value
                      )
                    }
                  />

                </div>

              </div>

              <div className="teacher-account-section-title account-section-space">

                <span>
                  ACCOUNT INFORMATION
                </span>

                <h4>
                  Login & Access
                </h4>

              </div>

              <div className="teacher-account-grid">

                <div className="teacher-account-info-box">

                  <span>
                    EMAIL
                  </span>

                  <strong>
                    {profile.email ||
                      "—"}
                  </strong>

                </div>

                <div className="teacher-account-info-box">

                  <span>
                    ROLE
                  </span>

                  <strong>
                    Teacher
                  </strong>

                </div>

                <div className="teacher-account-info-box">

                  <span>
                    DATE CREATED
                  </span>

                  <strong>
                    {formatTimestamp(
                      profile.createdAt
                    )}
                  </strong>

                </div>

                <div className="teacher-account-info-box">

                  <span>
                    USER ID
                  </span>

                  <strong className="teacher-account-uid">
                    {profile.uid}
                  </strong>

                </div>

              </div>

              {editing && (
                <div className="teacher-account-save-area">

                  <button
                    type="button"
                    className="teacher-account-save"
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
              )}

            </section>
          )}

        </main>

      </div>
    </div>
  );
}

export default TeacherAccountPage;