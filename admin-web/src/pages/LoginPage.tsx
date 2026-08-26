import {
  useState,
  type SyntheticEvent,
} from "react";

import { useNavigate } from "react-router";

import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import mathalinoLogo from "../assets/mathalino-logo.png";

import "./LoginPage.css";

/*
 * Converts Firebase authentication errors
 * into user-friendly messages.
 */
function getLoginErrorMessage(error: unknown): string {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return "Unable to sign in. Please try again.";
  }

  const firebaseError = error as { code: string };

  switch (firebaseError.code) {
    case "auth/invalid-credential":
      return "Incorrect email or password.";

    case "auth/too-many-requests":
      return "Too many login attempts. Please try again later.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";

    default:
      return "Unable to sign in. Please try again.";
  }
}

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loginAdmin = async () => {
    setError("");

    if (!email.trim() || !password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    try {
      setLoading(true);

      /*
       * Step 1:
       * Authenticate using Firebase Authentication.
       */
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const uid = credential.user.uid;

      /*
       * Step 2:
       * Find the corresponding Firestore user.
       */
      const userReference = doc(
        db,
        "users",
        uid
      );

      const userSnapshot =
        await getDoc(userReference);

      /*
       * Firebase Auth account exists,
       * but Firestore profile does not.
       */
      if (!userSnapshot.exists()) {
        await signOut(auth);

        setError(
          "Account information could not be found."
        );

        return;
      }

      const userData = userSnapshot.data();

      /*
       * Only administrators may access
       * the Mathalino Admin Web.
       */
      if (userData.role !== "admin") {
        await signOut(auth);

        setError(
          "Access denied. This portal is for administrators only."
        );

        return;
      }

      /*
       * Successful administrator login.
       */
      navigate("/dashboard");
    } catch (error: unknown) {
      console.error(
        "Firebase login error:",
        error
      );

      setError(
        getLoginErrorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Keep the form event handler synchronous.
   * Firebase login runs separately.
   */
  const handleLogin = (
    event: SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    void loginAdmin();
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <img
            src={mathalinoLogo}
            alt="Mathalino Logo"
            className="login-logo"
          />

          <div className="login-brand-text">
            <h1>Mathalino</h1>
            <p>LEARN BY DOING</p>
          </div>
        </div>

        <div className="login-heading">
          <span className="login-eyebrow">
            ADMINISTRATOR ACCESS
          </span>

          <h2>
            Log in to Mathalino
          </h2>
        </div>

        <form
          className="login-form"
          onSubmit={handleLogin}
        >
          <div className="form-group">
            <label htmlFor="admin-email">
              Email
            </label>

            <input
              id="admin-email"
              type="email"
              value={email}
              placeholder="admin@mathalino.edu"
              autoComplete="email"
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="admin-password">
              Password
            </label>

            <input
              id="admin-password"
              type="password"
              value={password}
              placeholder="••••••••"
              autoComplete="current-password"
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
            />
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
              ? "Logging in..."
              : "Log in"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default LoginPage;