import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useNavigate } from "react-router";
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

      <header className="dashboard-header">
        <div className="dashboard-brand">
          <h2>Mathalino</h2>
          <p>Administration Portal</p>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          Log Out
        </button>
      </header>

      <main className="dashboard-content">

        <section className="dashboard-welcome">
          <h1>Administrator Dashboard</h1>
          <p>
            Welcome to the Mathalino administration portal.
          </p>
        </section>

        <section className="management-section">
          <h3>Administration</h3>

          <div className="management-card">
            <h2>User Account Management</h2>

            <p>
              View registered teacher, guardian, and learner
              accounts within the Mathalino platform.
            </p>

            <button
              type="button"
              className="view-users-button"
              onClick={handleViewUsers}
            >
              View User Accounts
            </button>
          </div>
        </section>

      </main>

    </div>
  );
}

export default DashboardPage;