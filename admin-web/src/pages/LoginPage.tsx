import {
  useState,
  type FormEvent,
} from "react";

import {
  useNavigate,
} from "react-router";

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from "firebase/auth";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import mathalinoLogo from "../assets/mathalino-logo.png";

import "./LoginPage.css";
import "./TeacherRegistrationModal.css";

const TEACHER_TITLES = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "Mx.",
  "No title",
];

const TEACHER_SCHOOLS = [
  "University of Cebu - Banilad",
];

function getFirebaseErrorCode(
  error: unknown
): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error
  ) {
    return String(
      (
        error as {
          code?: unknown;
        }
      ).code ?? ""
    );
  }

  return "";
}

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "";
}

async function authenticateRegistration(
  email: string,
  password: string
): Promise<UserCredential> {
  try {
    return await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
  } catch (error) {
    const code =
      getFirebaseErrorCode(
        error
      );

    if (
      code ===
      "auth/email-already-in-use"
    ) {
      return await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
    }

    throw error;
  }
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />

      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="11"
        rx="2"
      />

      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />

      <circle
        cx="12"
        cy="12"
        r="2.6"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 3 18 18" />

      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />

      <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a17.3 17.3 0 0 1-2.1 3.1" />

      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8a9.8 9.8 0 0 0 4.1-.9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />

      <path d="m6 6 12 12" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />

      <path d="M20 4v7h-7" />

      <path d="M12 8v4l2.5 2" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />

      <circle
        cx="8"
        cy="7"
        r="4"
      />

      <path d="M19 8v6" />

      <path d="M16 11h6" />
    </svg>
  );
}

function LoginPage() {
  const navigate =
    useNavigate();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    resetOpen,
    setResetOpen,
  ] = useState(false);

  const [
    resetEmail,
    setResetEmail,
  ] = useState("");

  const [
    resetLoading,
    setResetLoading,
  ] = useState(false);

  const [
    resetError,
    setResetError,
  ] = useState("");

  const [
    resetSuccess,
    setResetSuccess,
  ] = useState("");

  const [
    registrationOpen,
    setRegistrationOpen,
  ] = useState(false);

  const [
    registrationTitle,
    setRegistrationTitle,
  ] = useState("");

  const [
    registrationFirstName,
    setRegistrationFirstName,
  ] = useState("");

  const [
    registrationMiddleInitial,
    setRegistrationMiddleInitial,
  ] = useState("");

  const [
    registrationLastName,
    setRegistrationLastName,
  ] = useState("");

  const [
    registrationEmail,
    setRegistrationEmail,
  ] = useState("");

  const [
    registrationSchool,
    setRegistrationSchool,
  ] = useState("");

  const [
    registrationPassword,
    setRegistrationPassword,
  ] = useState("");

  const [
    registrationConfirmPassword,
    setRegistrationConfirmPassword,
  ] = useState("");

  const [
    registrationShowPassword,
    setRegistrationShowPassword,
  ] = useState(false);

  const [
    registrationShowConfirm,
    setRegistrationShowConfirm,
  ] = useState(false);

  const [
    registrationLoading,
    setRegistrationLoading,
  ] = useState(false);

  const [
    registrationError,
    setRegistrationError,
  ] = useState("");

  const [
    registrationSuccess,
    setRegistrationSuccess,
  ] = useState("");

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      if (
        !normalizedEmail ||
        !password
      ) {
        setError(
          "Enter your email address and password."
        );

        return;
      }

      try {
        setLoading(true);

        setError("");

        const credential =
          await signInWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
          );

        const userReference =
          doc(
            db,
            "users",
            credential.user.uid
          );

        const userSnapshot =
          await getDoc(
            userReference
          );

        if (
          !userSnapshot.exists()
        ) {
          await signOut(
            auth
          );

          setError(
            "Account information could not be found."
          );

          return;
        }

        const data =
          userSnapshot.data();

        const role =
          String(
            data.role ??
              ""
          )
            .trim()
            .toLowerCase();

        if (
          role ===
          "admin"
        ) {
          navigate(
            "/dashboard",
            {
              replace: true,
            }
          );

          return;
        }

        if (
          role ===
          "teacher"
        ) {
          navigate(
            "/teacher-dashboard",
            {
              replace: true,
            }
          );

          return;
        }

        await signOut(
          auth
        );

        setError(
          "This account does not have access to the Mathalino Web Portal."
        );
      } catch (
        loginError
      ) {
        console.error(
          "Login error:",
          loginError
        );

        const code =
          getFirebaseErrorCode(
            loginError
          );

        if (
          code ===
            "auth/invalid-credential" ||
          code ===
            "auth/wrong-password" ||
          code ===
            "auth/user-not-found"
        ) {
          setError(
            "Incorrect email or password."
          );
        } else if (
          code ===
          "auth/too-many-requests"
        ) {
          setError(
            "Too many login attempts. Please try again later."
          );
        } else if (
          code ===
          "auth/network-request-failed"
        ) {
          setError(
            "Unable to connect. Check your internet connection and try again."
          );
        } else {
          setError(
            "Unable to sign in. Please try again."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  const openReset =
    () => {
      setRegistrationOpen(
        false
      );

      setResetEmail(
        email
          .trim()
          .toLowerCase()
      );

      setResetError("");

      setResetSuccess("");

      setResetOpen(
        true
      );
    };

  const closeReset =
    () => {
      if (
        resetLoading
      ) {
        return;
      }

      setResetOpen(
        false
      );

      setResetError("");

      setResetSuccess("");
    };

  const handlePasswordReset =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      const normalizedEmail =
        resetEmail
          .trim()
          .toLowerCase();

      if (
        !normalizedEmail ||
        !normalizedEmail.includes(
          "@"
        )
      ) {
        setResetError(
          "Enter a valid email address."
        );

        return;
      }

      try {
        setResetLoading(
          true
        );

        setResetError("");

        setResetSuccess("");

        await sendPasswordResetEmail(
          auth,
          normalizedEmail
        );

        setResetSuccess(
          "Password reset email sent. Check your inbox and spam folder for the reset link."
        );
      } catch (
        resetRequestError
      ) {
        console.error(
          "Password reset error:",
          resetRequestError
        );

        const code =
          getFirebaseErrorCode(
            resetRequestError
          );

        if (
          code ===
          "auth/invalid-email"
        ) {
          setResetError(
            "Enter a valid email address."
          );
        } else if (
          code ===
          "auth/too-many-requests"
        ) {
          setResetError(
            "Too many password reset attempts. Please try again later."
          );
        } else if (
          code ===
          "auth/network-request-failed"
        ) {
          setResetError(
            "Unable to connect. Check your internet connection and try again."
          );
        } else {
          setResetError(
            "Unable to send the password reset email. Please try again."
          );
        }
      } finally {
        setResetLoading(
          false
        );
      }
    };

  const openRegistration =
    () => {
      setResetOpen(
        false
      );

      setRegistrationError(
        ""
      );

      setRegistrationSuccess(
        ""
      );

      setRegistrationOpen(
        true
      );
    };

  const closeRegistration =
    () => {
      if (
        registrationLoading
      ) {
        return;
      }

      setRegistrationOpen(
        false
      );

      setRegistrationError(
        ""
      );

      setRegistrationSuccess(
        ""
      );
    };

  const handleTeacherRegistration =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      const title =
        registrationTitle.trim();

      const firstName =
        registrationFirstName.trim();

      const middleInitial =
        registrationMiddleInitial
          .trim()
          .toUpperCase();

      const lastName =
        registrationLastName.trim();

      const normalizedEmail =
        registrationEmail
          .trim()
          .toLowerCase();

      const school =
        registrationSchool.trim();

      const newPassword =
        registrationPassword;

      const confirmPassword =
        registrationConfirmPassword;

      setRegistrationError(
        ""
      );

      setRegistrationSuccess(
        ""
      );

      if (
        !TEACHER_TITLES.includes(
          title
        )
      ) {
        setRegistrationError(
          "Select a title."
        );

        return;
      }

      if (!firstName) {
        setRegistrationError(
          "Enter your first name."
        );

        return;
      }

      if (!lastName) {
        setRegistrationError(
          "Enter your last name."
        );

        return;
      }

      if (
        !normalizedEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          normalizedEmail
        )
      ) {
        setRegistrationError(
          "Enter a valid email address."
        );

        return;
      }

      if (
        !TEACHER_SCHOOLS.includes(
          school
        )
      ) {
        setRegistrationError(
          "Select a school or organization."
        );

        return;
      }

      if (
        newPassword.length < 6
      ) {
        setRegistrationError(
          "Password must contain at least 6 characters."
        );

        return;
      }

      if (
        confirmPassword !==
        newPassword
      ) {
        setRegistrationError(
          "Passwords do not match."
        );

        return;
      }

      const fullName = [
        firstName,
        middleInitial
          ? `${middleInitial}.`
          : null,
        lastName,
      ]
        .filter(Boolean)
        .join(" ");

      const displayName =
        title ===
        "No title"
          ? firstName
          : `${title} ${lastName}`;

      try {
        setRegistrationLoading(
          true
        );

        const credential =
          await authenticateRegistration(
            normalizedEmail,
            newPassword
          );

        const user =
          credential.user;

        const userReference =
          doc(
            db,
            "users",
            user.uid
          );

        try {
          await runTransaction(
            db,
            async (
              transaction
            ) => {
              const existing =
                await transaction.get(
                  userReference
                );

              if (
                existing.exists()
              ) {
                throw new Error(
                  "PROFILE_ALREADY_EXISTS"
                );
              }

              transaction.set(
                userReference,
                {
                  uid:
                    user.uid,

                  title,

                  firstName,

                  middleInitial,

                  lastName,

                  fullName,

                  displayName,

                  email:
                    normalizedEmail,

                  role:
                    "teacher",

                  school,

                  createdAt:
                    serverTimestamp(),
                }
              );
            }
          );
        } catch (
          profileError
        ) {
          if (
            getErrorMessage(
              profileError
            ) ===
            "PROFILE_ALREADY_EXISTS"
          ) {
            await signOut(
              auth
            );

            setRegistrationError(
              "This account already has a teacher profile. Please sign in or use Forgot Password."
            );

            return;
          }

          throw profileError;
        }

        await signOut(
          auth
        );

        setEmail(
          normalizedEmail
        );

        setPassword("");

        setRegistrationSuccess(
          "Teacher account created successfully. You can now sign in using your new account."
        );
      } catch (
        registrationRequestError
      ) {
        console.error(
          "Teacher registration error:",
          registrationRequestError
        );

        try {
          await signOut(
            auth
          );
        } catch {
          // Cleanup only.
        }

        const code =
          getFirebaseErrorCode(
            registrationRequestError
          );

        if (
          code ===
          "auth/invalid-email"
        ) {
          setRegistrationError(
            "Enter a valid email address."
          );
        } else if (
          code ===
          "auth/weak-password"
        ) {
          setRegistrationError(
            "Choose a stronger password with at least 6 characters."
          );
        } else if (
          code ===
            "auth/wrong-password" ||
          code ===
            "auth/invalid-credential"
        ) {
          setRegistrationError(
            "An account already uses this email. Use the correct password or Forgot Password."
          );
        } else if (
          code ===
          "auth/too-many-requests"
        ) {
          setRegistrationError(
            "Too many account attempts. Please try again later."
          );
        } else if (
          code ===
          "auth/network-request-failed"
        ) {
          setRegistrationError(
            "Unable to connect. Check your internet connection and try again."
          );
        } else {
          setRegistrationError(
            "Account creation failed. Please try again."
          );
        }
      } finally {
        setRegistrationLoading(
          false
        );
      }
    };

  return (
    <>
      <div className="login-page">

        <div className="login-shell">

          <section className="login-visual">

            <div className="login-decor-circle circle-one" />
            <div className="login-decor-circle circle-two" />

            <div
              className="login-pattern"
              aria-hidden="true"
            >
              <span className="login-symbol symbol-1">+</span>
              <span className="login-symbol symbol-2">7</span>
              <span className="login-symbol symbol-3">=</span>
              <span className="login-symbol symbol-4">−</span>
              <span className="login-symbol symbol-5">10</span>
              <span className="login-symbol symbol-6">+</span>
              <span className="login-symbol symbol-7">3</span>
              <span className="login-symbol symbol-8">=</span>
              <span className="login-symbol symbol-9">5</span>
              <span className="login-symbol symbol-10">−</span>
            </div>

            <div className="login-visual-content">

              <span className="login-visual-eyebrow">
                MATHALINO LEARNING SYSTEM
              </span>

              <h1>
                Learn by
                <br />
                Doing.
              </h1>

              <p>
                Bringing mathematics
                to life through
                hands-on learning,
                smart technology,
                and meaningful
                classroom experiences.
              </p>

              <div
                className="login-equation"
                aria-label="Seven plus three equals ten"
              >
                <div className="login-math-block">
                  7
                </div>

                <div className="login-math-block operator">
                  +
                </div>

                <div className="login-math-block">
                  3
                </div>

                <span className="login-equals">
                  =
                </span>

                <div className="login-answer-block">
                  10
                </div>
              </div>

              <div className="login-visual-note">

                <div className="login-visual-note-icon">
                  M
                </div>

                <div>
                  <strong>
                    Smart Mathematics Learning
                  </strong>

                  <span>
                    Designed for young
                    learners through
                    interactive practice.
                  </span>
                </div>

              </div>

            </div>

          </section>

          <section className="login-form-panel">

            <div className="login-card">

              <div className="login-brand">

                <img
                  src={mathalinoLogo}
                  alt="Mathalino Logo"
                  className="login-logo"
                />

                <div className="login-brand-text">
                  <h1>
                    Mathalino
                  </h1>

                  <p>
                    LEARN BY DOING
                  </p>
                </div>

              </div>

              <div className="login-heading">

                <span className="login-eyebrow">
                  WELCOME BACK
                </span>

                <h2>
                  Sign in to Mathalino
                </h2>

                <p>
                  Enter your account
                  information to
                  continue.
                </p>

              </div>

              <form
                className="login-form"
                onSubmit={
                  handleSubmit
                }
              >

                <div className="login-form-group">

                  <label htmlFor="login-email">
                    Email
                  </label>

                  <div className="login-input-wrapper">

                    <span className="login-input-icon">
                      <MailIcon />
                    </span>

                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      value={email}
                      disabled={loading}
                      onChange={(
                        event
                      ) => {
                        setEmail(
                          event
                            .target
                            .value
                        );

                        setError("");
                      }}
                    />

                  </div>

                </div>

                <div className="login-form-group">

                  <label htmlFor="login-password">
                    Password
                  </label>

                  <div className="login-input-wrapper">

                    <span className="login-input-icon">
                      <LockIcon />
                    </span>

                    <input
                      id="login-password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      disabled={loading}
                      onChange={(
                        event
                      ) => {
                        setPassword(
                          event
                            .target
                            .value
                        );

                        setError("");
                      }}
                    />

                    <button
                      type="button"
                      className="login-password-toggle"
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      disabled={loading}
                      onClick={() =>
                        setShowPassword(
                          (
                            current
                          ) =>
                            !current
                        )
                      }
                    >
                      {showPassword ? (
                        <EyeOffIcon />
                      ) : (
                        <EyeIcon />
                      )}
                    </button>

                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "flex-end",
                      marginTop:
                        "4px",
                    }}
                  >
                    <button
                      type="button"
                      className="login-forgot-button"
                      disabled={loading}
                      onClick={
                        openReset
                      }
                    >
                      Forgot Password?
                    </button>
                  </div>

                </div>

                {error && (
                  <div
                    className="login-error"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="login-button"
                  disabled={loading}
                >
                  {loading
                    ? "Signing in..."
                    : "Sign In"}
                </button>

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap:
                      "6px",
                    marginTop:
                      "10px",
                    fontSize:
                      "13px",
                    color:
                      "#71858c",
                  }}
                >
                  <span>
                    New teacher?
                  </span>

                  <button
                    type="button"
                    className="login-forgot-button"
                    disabled={loading}
                    onClick={
                      openRegistration
                    }
                  >
                    Create Account
                  </button>
                </div>

              </form>

              <div className="login-footer-note">
                Mathalino · University
                of Cebu – Banilad
              </div>

            </div>

          </section>

        </div>

      </div>

      {resetOpen && (
        <div
          className="login-reset-backdrop"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeReset();
            }
          }}
        >

          <div
            className="login-reset-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
          >

            <button
              type="button"
              className="login-reset-close"
              aria-label="Close password reset"
              disabled={resetLoading}
              onClick={closeReset}
            >
              <CloseIcon />
            </button>

            <div className="login-reset-icon">
              <ResetIcon />
            </div>

            <span className="login-reset-eyebrow">
              ACCOUNT RECOVERY
            </span>

            <h2 id="reset-password-title">
              Reset Password
            </h2>

            <p className="login-reset-description">
              Enter the email
              address associated
              with your Mathalino
              account.
            </p>

            {!resetSuccess ? (
              <form
                className="login-reset-form"
                onSubmit={
                  handlePasswordReset
                }
              >

                <div className="login-form-group">

                  <label htmlFor="reset-email">
                    Email
                  </label>

                  <div className="login-input-wrapper">

                    <span className="login-input-icon">
                      <MailIcon />
                    </span>

                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      disabled={resetLoading}
                      autoFocus
                      onChange={(
                        event
                      ) => {
                        setResetEmail(
                          event
                            .target
                            .value
                        );

                        setResetError("");
                      }}
                    />

                  </div>

                </div>

                {resetError && (
                  <div
                    className="login-error login-reset-message"
                    role="alert"
                  >
                    {resetError}
                  </div>
                )}

                <button
                  type="submit"
                  className="login-button"
                  disabled={resetLoading}
                >
                  {resetLoading
                    ? "Sending..."
                    : "Send Reset Email"}
                </button>

              </form>
            ) : (
              <div className="login-reset-success-area">

                <div
                  className="login-success"
                  role="status"
                >
                  {resetSuccess}
                </div>

                <button
                  type="button"
                  className="login-button"
                  onClick={closeReset}
                >
                  Back to Sign In
                </button>

              </div>
            )}

          </div>

        </div>
      )}

      {registrationOpen && (
        <div
          className="login-reset-backdrop"
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeRegistration();
            }
          }}
        >

          <div
            className="teacher-register-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-registration-title"
          >

            {!registrationSuccess ? (
              <>
                <div className="teacher-register-header">

                  <div className="teacher-register-header-icon">
                    <UserPlusIcon />
                  </div>

                  <div className="teacher-register-header-text">

                    <span className="teacher-register-eyebrow">
                      TEACHER REGISTRATION
                    </span>

                    <h2 id="teacher-registration-title">
                      Create Teacher Account
                    </h2>

                    <p>
                      Create a Mathalino teacher
                      account for web and mobile access.
                    </p>

                  </div>

                  <button
                    type="button"
                    className="teacher-register-close"
                    aria-label="Close teacher registration"
                    disabled={
                      registrationLoading
                    }
                    onClick={
                      closeRegistration
                    }
                  >
                    <CloseIcon />
                  </button>

                </div>

                <form
                  className="teacher-register-form"
                  onSubmit={
                    handleTeacherRegistration
                  }
                >

                  <div className="teacher-register-columns">

                    <section className="teacher-register-section">

                      <div className="teacher-register-section-heading">

                        <span>
                          PERSONAL INFORMATION
                        </span>

                        <h3>
                          Teacher Details
                        </h3>

                        <p>
                          Basic information used
                          for the teacher profile.
                        </p>

                      </div>

                      <div className="teacher-register-field-grid">

                        <div className="teacher-register-field">

                          <label htmlFor="registration-title">
                            Title
                          </label>

                          <select
                            id="registration-title"
                            value={
                              registrationTitle
                            }
                            disabled={
                              registrationLoading
                            }
                            onChange={(
                              event
                            ) => {
                              setRegistrationTitle(
                                event
                                  .target
                                  .value
                              );

                              setRegistrationError(
                                ""
                              );
                            }}
                          >
                            <option value="">
                              Select title
                            </option>

                            {TEACHER_TITLES.map(
                              (
                                title
                              ) => (
                                <option
                                  key={title}
                                  value={title}
                                >
                                  {title}
                                </option>
                              )
                            )}

                          </select>

                        </div>

                        <div className="teacher-register-field">

                          <label htmlFor="registration-first-name">
                            First Name
                          </label>

                          <div className="teacher-register-input-wrapper">

                            <input
                              id="registration-first-name"
                              type="text"
                              autoComplete="given-name"
                              placeholder="First name"
                              value={
                                registrationFirstName
                              }
                              disabled={
                                registrationLoading
                              }
                              onChange={(
                                event
                              ) => {
                                setRegistrationFirstName(
                                  event
                                    .target
                                    .value
                                );

                                setRegistrationError(
                                  ""
                                );
                              }}
                            />

                          </div>

                        </div>

                        <div className="teacher-register-field">

                          <label htmlFor="registration-middle">
                            Middle Initial
                            {" "}
                            <span className="teacher-register-optional">
                              (optional)
                            </span>
                          </label>

                          <div className="teacher-register-input-wrapper">

                            <input
                              id="registration-middle"
                              type="text"
                              autoComplete="additional-name"
                              placeholder="e.g. P"
                              maxLength={1}
                              value={
                                registrationMiddleInitial
                              }
                              disabled={
                                registrationLoading
                              }
                              onChange={(
                                event
                              ) => {
                                setRegistrationMiddleInitial(
                                  event
                                    .target
                                    .value
                                    .slice(
                                      0,
                                      1
                                    )
                                    .toUpperCase()
                                );

                                setRegistrationError(
                                  ""
                                );
                              }}
                            />

                          </div>

                        </div>

                        <div className="teacher-register-field">

                          <label htmlFor="registration-last-name">
                            Last Name
                          </label>

                          <div className="teacher-register-input-wrapper">

                            <input
                              id="registration-last-name"
                              type="text"
                              autoComplete="family-name"
                              placeholder="Last name"
                              value={
                                registrationLastName
                              }
                              disabled={
                                registrationLoading
                              }
                              onChange={(
                                event
                              ) => {
                                setRegistrationLastName(
                                  event
                                    .target
                                    .value
                                );

                                setRegistrationError(
                                  ""
                                );
                              }}
                            />

                          </div>

                        </div>

                      </div>

                    </section>

                    <section className="teacher-register-section">

                      <div className="teacher-register-section-heading">

                        <span>
                          ACCOUNT INFORMATION
                        </span>

                        <h3>
                          Sign-in Details
                        </h3>

                        <p>
                          Credentials used across
                          Mathalino web and mobile.
                        </p>

                      </div>

                      <div className="teacher-register-field-grid">

                        <div className="teacher-register-field full">

                          <label htmlFor="registration-email">
                            Email Address
                          </label>

                          <div className="teacher-register-input-wrapper">

                            <span className="teacher-register-input-icon">
                              <MailIcon />
                            </span>

                            <input
                              id="registration-email"
                              className="has-icon"
                              type="email"
                              autoComplete="email"
                              placeholder="name@email.com"
                              value={
                                registrationEmail
                              }
                              disabled={
                                registrationLoading
                              }
                              onChange={(
                                event
                              ) => {
                                setRegistrationEmail(
                                  event
                                    .target
                                    .value
                                );

                                setRegistrationError(
                                  ""
                                );
                              }}
                            />

                          </div>

                        </div>

                        <div className="teacher-register-field full">

                          <label htmlFor="registration-school">
                            School or Organization
                          </label>

                          <select
                            id="registration-school"
                            value={
                              registrationSchool
                            }
                            disabled={
                              registrationLoading
                            }
                            onChange={(
                              event
                            ) => {
                              setRegistrationSchool(
                                event
                                  .target
                                  .value
                              );

                              setRegistrationError(
                                ""
                              );
                            }}
                          >
                            <option value="">
                              Select school or organization
                            </option>

                            {TEACHER_SCHOOLS.map(
                              (
                                school
                              ) => (
                                <option
                                  key={school}
                                  value={school}
                                >
                                  {school}
                                </option>
                              )
                            )}

                          </select>

                        </div>

                        <div className="teacher-register-field">

                          <label htmlFor="registration-password">
                            Password
                          </label>

                          <div className="teacher-register-input-wrapper">

                            <span className="teacher-register-input-icon">
                              <LockIcon />
                            </span>

                            <input
                              id="registration-password"
                              className="has-icon has-action"
                              type={
                                registrationShowPassword
                                  ? "text"
                                  : "password"
                              }
                              autoComplete="new-password"
                              placeholder="Minimum 6 characters"
                              value={
                                registrationPassword
                              }
                              disabled={
                                registrationLoading
                              }
                              onChange={(
                                event
                              ) => {
                                setRegistrationPassword(
                                  event
                                    .target
                                    .value
                                );

                                setRegistrationError(
                                  ""
                                );
                              }}
                            />

                            <button
                              type="button"
                              className="teacher-register-password-toggle"
                              aria-label={
                                registrationShowPassword
                                  ? "Hide password"
                                  : "Show password"
                              }
                              disabled={
                                registrationLoading
                              }
                              onClick={() =>
                                setRegistrationShowPassword(
                                  (
                                    current
                                  ) =>
                                    !current
                                )
                              }
                            >
                              {registrationShowPassword ? (
                                <EyeOffIcon />
                              ) : (
                                <EyeIcon />
                              )}
                            </button>

                          </div>

                        </div>

                        <div className="teacher-register-field">

                          <label htmlFor="registration-confirm-password">
                            Confirm Password
                          </label>

                          <div className="teacher-register-input-wrapper">

                            <span className="teacher-register-input-icon">
                              <LockIcon />
                            </span>

                            <input
                              id="registration-confirm-password"
                              className="has-icon has-action"
                              type={
                                registrationShowConfirm
                                  ? "text"
                                  : "password"
                              }
                              autoComplete="new-password"
                              placeholder="Re-enter password"
                              value={
                                registrationConfirmPassword
                              }
                              disabled={
                                registrationLoading
                              }
                              onChange={(
                                event
                              ) => {
                                setRegistrationConfirmPassword(
                                  event
                                    .target
                                    .value
                                );

                                setRegistrationError(
                                  ""
                                );
                              }}
                            />

                            <button
                              type="button"
                              className="teacher-register-password-toggle"
                              aria-label={
                                registrationShowConfirm
                                  ? "Hide confirmation password"
                                  : "Show confirmation password"
                              }
                              disabled={
                                registrationLoading
                              }
                              onClick={() =>
                                setRegistrationShowConfirm(
                                  (
                                    current
                                  ) =>
                                    !current
                                )
                              }
                            >
                              {registrationShowConfirm ? (
                                <EyeOffIcon />
                              ) : (
                                <EyeIcon />
                              )}
                            </button>

                          </div>

                        </div>

                      </div>

                    </section>

                  </div>

                  {registrationError && (
                    <div
                      className="teacher-register-message error"
                      role="alert"
                    >
                      {registrationError}
                    </div>
                  )}

                  <div className="teacher-register-actions">

                    <button
                      type="button"
                      className="teacher-register-cancel"
                      disabled={
                        registrationLoading
                      }
                      onClick={
                        closeRegistration
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="teacher-register-submit"
                      disabled={
                        registrationLoading
                      }
                    >
                      {registrationLoading
                        ? "Creating Account..."
                        : "Create Account"}
                    </button>

                  </div>

                </form>
              </>
            ) : (
              <div className="teacher-register-success">

                <div className="teacher-register-success-icon">
                  ✓
                </div>

                <h3>
                  Account Created
                </h3>

                <p>
                  {registrationSuccess}
                </p>

                <button
                  type="button"
                  className="teacher-register-submit"
                  onClick={
                    closeRegistration
                  }
                >
                  Back to Sign In
                </button>

              </div>
            )}

          </div>

        </div>
      )}
    </>
  );
}

export default LoginPage;