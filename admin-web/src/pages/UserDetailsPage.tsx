import { useLocation, useNavigate, useParams } from "react-router";
import "./UserDetailsPage.css";

interface UserData {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLogin: string;
}

interface LocationState {
  user?: UserData;
  role?: string;
}

function UserDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams();

  const state = location.state as LocationState | null;

  const user = state?.user;
  const role = state?.role;

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
          <p>
            View registered account information.
          </p>
        </div>

        {user ? (
          <div className="details-card">

            <div className="details-card-header">
              <h2>{user.name}</h2>

              <span className="role-badge">
                {role}
              </span>
            </div>

            <div className="details-grid">

              <div className="detail-item">
                <span className="detail-label">
                  User ID
                </span>

                <span className="detail-value">
                  {userId}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Role
                </span>

                <span className="detail-value">
                  {role}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Full Name
                </span>

                <span className="detail-value">
                  {user.name}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Email / Username
                </span>

                <span className="detail-value">
                  {user.email}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Account Status
                </span>

                <span
                  className={
                    user.status === "Active"
                      ? "details-status details-status-active"
                      : "details-status details-status-inactive"
                  }
                >
                  {user.status}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  Last Login
                </span>

                <span className="detail-value">
                  {user.lastLogin}
                </span>
              </div>

            </div>

            <div className="read-only-note">
              This account is displayed in read-only mode.
              Administrator access is limited to account oversight.
            </div>

          </div>
        ) : (
          <div className="no-user-card">
            <h2>User information unavailable</h2>

            <p>
              Return to User Accounts and select View Details again.
            </p>

            <button
              className="back-users-button"
              onClick={() => navigate("/users")}
            >
              Return to User Accounts
            </button>
          </div>
        )}

      </main>

    </div>
  );
}

export default UserDetailsPage;