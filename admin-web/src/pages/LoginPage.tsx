import { useState } from "react";
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
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      // 1. Authenticate email and password
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const uid = credential.user.uid;

      // 2. Find this user in Firestore
      const userRef = doc(db, "users", uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        await signOut(auth);
        setError("User account information was not found.");
        return;
      }

      const userData = userSnapshot.data();

      // 3. Verify administrator role
      if (userData.role !== "admin") {
        await signOut(auth);
        setError(
          "Access denied. This portal is for administrators only."
        );
        return;
      }

      // 4. Open dashboard
      navigate("/dashboard");

    } catch (error: any) {
    console.error("Firebase login error:", error);

    if (error.code === "auth/invalid-credential") {
      setError("Incorrect email or password.");
    } else if (error.code === "auth/too-many-requests") {
      setError("Too many login attempts. Please try again later.");
    } else if (error.code === "auth/network-request-failed") {
      setError("Network error. Please check your internet connection.");
    } else {
      setError("Unable to sign in. Please try again.");
    }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <h1>Mathalino</h1>
          <p>Smart Mathematics Learning Platform</p>
        </div>

        <div className="login-title">
          <h2>Administrator Login</h2>
          <p>
            Sign in to access the administration portal.
          </p>
        </div>

        <div className="form-group">
          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter administrator email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
          />
        </div>

        <div className="form-group">
          <label>Password</label>

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
          />
        </div>

        {error && (
          <p className="login-error">
            {error}
          </p>
        )}

        <button
          className="login-button"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing In..." : "Log In"}
        </button>

        <p className="admin-note">
          Authorized administrators only
        </p>

      </div>
    </div>
  );
}

export default LoginPage;