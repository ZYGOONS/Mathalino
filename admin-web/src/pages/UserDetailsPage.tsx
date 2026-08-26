import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router";

import {
  doc,
  getDoc,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

import "./UserDetailsPage.css";

interface UserDetails {
  id: string;
  name: string;
  role: string;

  emailOrUsername: string;
  school: string;
  status: string;

  title: string;
  teacherId: string;

  createdAt: unknown;
  lastLogin: unknown;
}

function getDisplayName(
  data: DocumentData
): string {
  if (data.fullName) {
    return data.fullName;
  }

  if (data.displayName) {
    return data.displayName;
  }

  const name = [
    data.firstName,
    data.middleInitial,
    data.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return name || "Unnamed User";
}

function formatRole(role: string): string {
  if (!role) {
    return "—";
  }

  return (
    role.charAt(0).toUpperCase() +
    role.slice(1).toLowerCase()
  );
}

function formatTimestamp(
  value: unknown
): string {
  if (!value) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  const timestamp = value as Timestamp;

  if (
    typeof timestamp?.toDate === "function"
  ) {
    return timestamp
      .toDate()
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "2-digit",
      });
  }

  return "—";
}

function UserDetailsPage() {
  const navigate = useNavigate();

  const { userId } = useParams();

  const [user, setUser] =
    useState<UserDetails | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const loadUserDetails = async () => {
      if (!userId) {
        setError(
          "User ID was not provided."
        );

        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        setError("");

        /*
         * Check users collection first.
         * Teachers, guardians and administrators
         * are stored here.
         */
        const userReference = doc(
          db,
          "users",
          userId
        );

        const userSnapshot =
          await getDoc(userReference);

        if (userSnapshot.exists()) {
          const data =
            userSnapshot.data();

          setUser({
            id: userSnapshot.id,

            name:
              getDisplayName(data),

            role:
              data.role ??
              "user",

            emailOrUsername:
              data.email ??
              data.username ??
              "",

            school:
              data.school ??
              "",

            status:
              data.status ??
              data.accountStatus ??
              "",

            title:
              data.title ??
              "",

            teacherId:
              data.teacherId ??
              "",

            createdAt:
              data.createdAt,

            lastLogin:
              data.lastLogin,
          });

          return;
        }

        /*
         * If not found in users,
         * check learners collection.
         */
        const learnerReference = doc(
          db,
          "learners",
          userId
        );

        const learnerSnapshot =
          await getDoc(
            learnerReference
          );

        if (learnerSnapshot.exists()) {
          const data =
            learnerSnapshot.data();

          setUser({
            id:
              learnerSnapshot.id,

            name:
              getDisplayName(data),

            role:
              "learner",

            emailOrUsername:
              data.email ??
              data.username ??
              "",

            school:
              data.school ??
              "",

            status:
              data.status ??
              data.accountStatus ??
              "",

            title:
              "",

            teacherId:
              data.teacherId ??
              "",

            createdAt:
              data.createdAt,

            lastLogin:
              data.lastLogin,
          });

          return;
        }

        setError(
          "User account could not be found."
        );
      } catch (error: unknown) {
        console.error(
          "Error loading user details:",
          error
        );

        setError(
          "Unable to load the user account."
        );
      } finally {
        setLoading(false);
      }
    };

    loadUserDetails();
  }, [userId]);

  if (loading) {
    return (
      <div className="details-page">
        <div className="details-shell">
          <div className="details-card">
            <div className="details-message">
              Loading user details...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="details-page">
        <div className="details-shell">
          <div className="details-card">

            <button
              type="button"
              className="details-back"
              onClick={() =>
                navigate("/users")
              }
            >
              ← Back to user accounts
            </button>

            <div className="details-error">
              {error ||
                "User account could not be found."}
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="details-page">
      <div className="details-shell">
        <div className="details-card">

          <button
            type="button"
            className="details-back"
            onClick={() =>
              navigate("/users")
            }
          >
            ← Back to user accounts
          </button>

          <div className="details-heading">
            <span className="details-eyebrow">
              VIEW ONLY
            </span>

            <h1>{user.name}</h1>
          </div>

          <div className="details-grid">

            <div className="details-field">
              <span className="details-label">
                ROLE
              </span>

              <span className="details-value">
                {formatRole(user.role)}
              </span>
            </div>

            {user.emailOrUsername && (
              <div className="details-field">
                <span className="details-label">
                  EMAIL OR USERNAME
                </span>

                <span className="details-value">
                  {user.emailOrUsername}
                </span>
              </div>
            )}

            {user.status && (
              <div className="details-field">
                <span className="details-label">
                  ACCOUNT STATUS
                </span>

                <span className="details-value">
                  {formatRole(user.status)}
                </span>
              </div>
            )}

            {user.school && (
              <div className="details-field">
                <span className="details-label">
                  SCHOOL
                </span>

                <span className="details-value">
                  {user.school}
                </span>
              </div>
            )}

            {user.title && (
              <div className="details-field">
                <span className="details-label">
                  TITLE
                </span>

                <span className="details-value">
                  {user.title}
                </span>
              </div>
            )}

            {user.teacherId && (
              <div className="details-field">
                <span className="details-label">
                  TEACHER ID
                </span>

                <span className="details-value">
                  {user.teacherId}
                </span>
              </div>
            )}

            {Boolean(user.createdAt) && (
              <div className="details-field">
                <span className="details-label">
                  DATE CREATED
                </span>

                <span className="details-value">
                  {formatTimestamp(
                    user.createdAt
                  )}
                </span>
              </div>
            )}

            {Boolean(user.lastLogin) && (
              <div className="details-field">
                <span className="details-label">
                  LAST LOGIN
                </span>

                <span className="details-value">
                  {formatTimestamp(
                    user.lastLogin
                  )}
                </span>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}

export default UserDetailsPage;