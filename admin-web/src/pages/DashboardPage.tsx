import { useNavigate } from "react-router";
import { signOut } from "firebase/auth";

import { auth } from "../firebase/firebase";
import mathalinoLogo from "../assets/mathalino-logo.png";

import "./DashboardPage.css";

function DashboardPage() {
  const navigate = useNavigate();

  const handleViewUsers = () => {
    navigate("/users");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-card">

        <div className="dashboard-brand">
          <img
            src={mathalinoLogo}
            alt="Mathalino Logo"
            className="dashboard-logo"
          />

          <div className="dashboard-brand-text">
            <h1>Mathalino</h1>
            <p>LEARN BY DOING</p>
          </div>
        </div>

        <div className="dashboard-heading">
          <span className="dashboard-eyebrow">
            ADMINISTRATOR
          </span>

          <h2>Welcome back.</h2>

          <p>
            Manage and view Mathalino user accounts.
          </p>
        </div>

        <div className="dashboard-actions">
          <button
            type="button"
            className="dashboard-action primary-action"
            onClick={handleViewUsers}
          >
            <span className="action-icon">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>

            <span>View user accounts</span>
          </button>

          <button
            type="button"
            className="dashboard-action secondary-action"
            onClick={handleLogout}
          >
            <span className="action-icon">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>

            <span>Log out</span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default DashboardPage;