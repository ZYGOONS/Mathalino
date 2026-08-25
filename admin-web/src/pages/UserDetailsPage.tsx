import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  doc,
  getDoc,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import "./UserDetailsPage.css";

function UserDetailsPage() {
  const navigate = useNavigate();
  const { userId } = useParams();

  const [user, setUser] = useState<DocumentData | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatTimestamp = (value: unknown) => {
    if (!value) {
      return "—";
    }

    const timestamp = value as Timestamp;

    if (typeof timestamp?.toDate === "function") {
      return timestamp.toDate().toLocaleString();
    }

    return "—";
  };

  useEffect(() => {
    const loadUser = async () => {
      if (!userId) {
        setError("Invalid user ID.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // First check authenticated users:
        // teacher, guardian, admin
        const userRef = doc(db, "users", userId);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          setUser({
            id: userSnapshot.id,
            ...userSnapshot.data(),
          });

          setCollectionName("users");
          return;
        }

        // If not found in users, check learners
        const learnerRef = doc(db, "learners", userId);
        const learnerSnapshot = await getDoc(learnerRef);

        if (learnerSnapshot.exists()) {
          setUser({
            id: learnerSnapshot.id,
            ...learnerSnapshot.data(),
            role: "learner",
          });

          setCollectionName("learners");
          return;
        }

        setError("User account could not be found.");
      } catch (err) {
        console.error("Error loading user details:", err);

        setError(
          "Unable to retrieve this account from Firebase."
        );
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  const getFullName = () => {
    if (!user) return "—";

    if (user.fullName) {
      return user.fullName;
    }

    if (user.displayName) {
      return user.displayName;
    }

    const name = [
      user.firstName,
      user.middleInitial,
      user.lastName,
    ]
      .filter(Boolean)
      .join(" ");

    return name || "Unnamed User";
  };

  return (
    <div className="user-details-page">

      <header className="user-details-header">
        <div>
          <h2>Mathalino</h2>
          <p>Administration Portal</p>
        </div>

        <button
          className="back-users-button"
          onClick={() => navigate("/users")}
        >
          Back to User Accounts
        </button>
      </header>

      <main className="user-details-content">

        <div className="details-title">
          <h1>User Details</h1>
          <p>View registered account information.</p>
        </div>

        {loading && (
          <div className="no-user-card">
            <p>Loading account information...</p>
          </div>
        )}

        {!loading && error && (
          <div className="no-user-card">
            <h2>User information unavailable</h2>

            <p>{error}</p>

            <button
              className="back-users-button"
              onClick={() => navigate("/users")}
            >
              Return to User Accounts
            </button>
          </div>
        )}

        {!loading && !error && user && (
          <div className="details-card">

            <div className="details-card-header">
              <h2>{getFullName()}</h2>

              <span className="role-badge">
                {user.role ?? "User"}
              </span>
            </div>

            <div className="details-grid">

              <div className="detail-item">
                <span className="detail-label">
                  User ID
                </span>

                <span className="detail-value">
                  {user.id ?? userId}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Role
                </span>

                <span className="detail-value">
                  {user.role ?? "—"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Full Name
                </span>

                <span className="detail-value">
                  {getFullName()}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Email / Username
                </span>

                <span className="detail-value">
                  {user.email ??
                    user.username ??
                    "—"}
                </span>
              </div>

              {user.title && (
                <div className="detail-item">
                  <span className="detail-label">
                    Title
                  </span>

                  <span className="detail-value">
                    {user.title}
                  </span>
                </div>
              )}

              {user.school && (
                <div className="detail-item">
                  <span className="detail-label">
                    School
                  </span>

                  <span className="detail-value">
                    {user.school}
                  </span>
                </div>
              )}

              {user.teacherId && (
                <div className="detail-item">
                  <span className="detail-label">
                    Teacher ID
                  </span>

                  <span className="detail-value">
                    {user.teacherId}
                  </span>
                </div>
              )}

              <div className="detail-item">
                <span className="detail-label">
                  Registered
                </span>

                <span className="detail-value">
                  {formatTimestamp(user.createdAt)}
                </span>
              </div>

              {user.lastLogin && (
                <div className="detail-item">
                  <span className="detail-label">
                    Last Login
                  </span>

                  <span className="detail-value">
                    {formatTimestamp(user.lastLogin)}
                  </span>
                </div>
              )}

            </div>

            <div className="read-only-note">
              This account is displayed in read-only mode.
              Administrator access is limited to account
              oversight.
            </div>

          </div>
        )}

      </main>

    </div>
  );
}

export default UserDetailsPage;