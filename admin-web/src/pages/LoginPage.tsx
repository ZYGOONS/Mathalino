import {
  useState,
  type FormEvent,
} from "react";

import {
  useNavigate,
} from "react-router";

import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import mathalinoLogo from "../assets/mathalino-logo.png";

import "./LoginPage.css";

/* =========================================================
   SHA-256
========================================================= */

async function sha256Hex(
  value: string
): Promise<string> {
  const normalized =
    value
      .trim()
      .toLowerCase();

  const encoded =
    new TextEncoder().encode(
      normalized
    );

  const digest =
    await window.crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  return Array.from(
    new Uint8Array(
      digest
    )
  )
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}

/* =========================================================
   TEACHER PASSWORD RESET CHECK
========================================================= */

async function teacherResetAllowed(
  email: string
): Promise<boolean> {
  const hash =
    await sha256Hex(
      email
    );

  const accessReference =
    doc(
      db,
      "teacherResetAccess",
      hash
    );

  const accessSnapshot =
    await getDoc(
      accessReference
    );

  if (
    !accessSnapshot.exists()
  ) {
    return false;
  }

  const data =
    accessSnapshot.data();

  return (
    data.allowed === true
  );
}

/* =========================================================
   FIREBASE ERROR CODE
========================================================= */

function getFirebaseErrorCode(
  error: unknown
): string {
  if (
    error &&
    typeof error ===
      "object" &&
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

/* =========================================================
   ICONS
========================================================= */

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

/* =========================================================
   LOGIN PAGE
========================================================= */

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

  /* =======================================================
     RESET PASSWORD STATE
  ======================================================= */

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

  /* =======================================================
     LOGIN
  ======================================================= */

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

  /* =======================================================
     OPEN RESET
  ======================================================= */

  const openReset =
    () => {
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

  /* =======================================================
     CLOSE RESET
  ======================================================= */

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

  /* =======================================================
     PASSWORD RESET
  ======================================================= */

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
          "Enter a valid teacher email address."
        );

        return;
      }

      try {
        setResetLoading(
          true
        );

        setResetError("");

        setResetSuccess("");

        const allowed =
          await teacherResetAllowed(
            normalizedEmail
          );

        if (
          !allowed
        ) {
          setResetError(
            "Password reset is available for teacher accounts only. Administrator accounts cannot recover their password from this page."
          );

          return;
        }

        await sendPasswordResetEmail(
          auth,
          normalizedEmail
        );

        setResetSuccess(
          "Password reset email sent. Check your inbox and follow the link to create a new password."
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

  return (
    <>
      <div className="login-page">

        <div className="login-shell">

          {/* ===============================================
              LEFT VISUAL PANEL
          =============================================== */}

          <section className="login-visual">

            <div className="login-decor-circle circle-one" />

            <div className="login-decor-circle circle-two" />

            <div
              className="login-pattern"
              aria-hidden="true"
            >
              <span className="login-symbol symbol-1">
                +
              </span>

              <span className="login-symbol symbol-2">
                7
              </span>

              <span className="login-symbol symbol-3">
                =
              </span>

              <span className="login-symbol symbol-4">
                −
              </span>

              <span className="login-symbol symbol-5">
                10
              </span>

              <span className="login-symbol symbol-6">
                +
              </span>

              <span className="login-symbol symbol-7">
                3
              </span>

              <span className="login-symbol symbol-8">
                =
              </span>

              <span className="login-symbol symbol-9">
                5
              </span>

              <span className="login-symbol symbol-10">
                −
              </span>
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

          {/* ===============================================
              LOGIN FORM PANEL
          =============================================== */}

          <section className="login-form-panel">

            <div className="login-card">

              <div className="login-brand">

                <img
                  src={
                    mathalinoLogo
                  }
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

                {/* EMAIL */}

                <div className="login-form-group">

                  <label
                    htmlFor="login-email"
                  >
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
                      value={
                        email
                      }
                      disabled={
                        loading
                      }
                      onChange={(
                        event
                      ) => {
                        setEmail(
                          event
                            .target
                            .value
                        );

                        setError(
                          ""
                        );
                      }}
                    />

                  </div>

                </div>

                {/* PASSWORD */}

                <div className="login-form-group">

                  <label
                    htmlFor="login-password"
                  >
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
                      value={
                        password
                      }
                      disabled={
                        loading
                      }
                      onChange={(
                        event
                      ) => {
                        setPassword(
                          event
                            .target
                            .value
                        );

                        setError(
                          ""
                        );
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
                      title={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      disabled={
                        loading
                      }
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

                  {/* MOVED BELOW PASSWORD FIELD */}

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "flex-end",
                      marginTop:
                        "2px",
                    }}
                  >
                    <button
                      type="button"
                      className="login-forgot-button"
                      disabled={
                        loading
                      }
                      onClick={
                        openReset
                      }
                    >
                      Forgot Password?
                    </button>
                  </div>

                </div>

                {/* LOGIN ERROR */}

                {error && (
                  <div
                    className="login-error"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                {/* LOGIN */}

                <button
                  type="submit"
                  className="login-button"
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? "Signing in..."
                    : "Sign In"}
                </button>

              </form>

              <div className="login-footer-note">
                Mathalino · University
                of Cebu – Banilad
              </div>

            </div>

          </section>

        </div>

      </div>

      {/* =====================================================
          PASSWORD RESET MODAL
      ====================================================== */}

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
              disabled={
                resetLoading
              }
              onClick={
                closeReset
              }
            >
              <CloseIcon />
            </button>

            <div className="login-reset-icon">
              <ResetIcon />
            </div>

            <span className="login-reset-eyebrow">
              TEACHER ACCOUNT
            </span>

            <h2 id="reset-password-title">
              Reset Password
            </h2>

            <p className="login-reset-description">
              Enter the email
              address associated
              with your Mathalino
              teacher account.
            </p>

            {!resetSuccess ? (
              <form
                className="login-reset-form"
                onSubmit={
                  handlePasswordReset
                }
              >

                <div className="login-form-group">

                  <label
                    htmlFor="reset-email"
                  >
                    Teacher Email
                  </label>

                  <div className="login-input-wrapper">

                    <span className="login-input-icon">
                      <MailIcon />
                    </span>

                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your teacher email"
                      value={
                        resetEmail
                      }
                      disabled={
                        resetLoading
                      }
                      autoFocus
                      onChange={(
                        event
                      ) => {
                        setResetEmail(
                          event
                            .target
                            .value
                        );

                        setResetError(
                          ""
                        );
                      }}
                    />

                  </div>

                </div>

                {resetError && (
                  <div
                    className="login-error login-reset-message"
                    role="alert"
                  >
                    {
                      resetError
                    }
                  </div>
                )}

                <button
                  type="submit"
                  className="login-button"
                  disabled={
                    resetLoading
                  }
                >
                  {resetLoading
                    ? "Checking account..."
                    : "Send Reset Email"}
                </button>

                <p className="login-reset-admin-note">
                  Password recovery
                  from this page is
                  available for
                  teacher accounts
                  only.
                </p>

              </form>
            ) : (
              <div className="login-reset-success-area">

                <div
                  className="login-success"
                  role="status"
                >
                  {
                    resetSuccess
                  }
                </div>

                <button
                  type="button"
                  className="login-button"
                  onClick={
                    closeReset
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