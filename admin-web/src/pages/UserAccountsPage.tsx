import { useState } from "react";
import { useNavigate } from "react-router";
import "./UserAccountsPage.css";

type UserRole = "Teachers" | "Guardians" | "Learners";

function UserAccountsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<UserRole>("Teachers");

  const teachers = [
    {
      id: "T001",
      name: "Maria Santos",
      email: "maria.santos@example.com",
      status: "Active",
      lastLogin: "Aug 19, 2026",
    },
    {
      id: "T002",
      name: "John Reyes",
      email: "john.reyes@example.com",
      status: "Active",
      lastLogin: "Aug 18, 2026",
    },
  ];

  const guardians = [
    {
      id: "G001",
      name: "Anna Cruz",
      email: "anna.cruz@example.com",
      status: "Active",
      lastLogin: "Aug 19, 2026",
    },
    {
      id: "G002",
      name: "Peter Lim",
      email: "peter.lim@example.com",
      status: "Inactive",
      lastLogin: "Aug 10, 2026",
    },
  ];

  const learners = [
    {
      id: "L001",
      name: "Joshua Santos",
      email: "joshua01",
      status: "Active",
      lastLogin: "Aug 19, 2026",
    },
    {
      id: "L002",
      name: "Angela Reyes",
      email: "angela02",
      status: "Active",
      lastLogin: "Aug 17, 2026",
    },
  ];

  const getUsers = () => {
    if (activeTab === "Teachers") return teachers;
    if (activeTab === "Guardians") return guardians;
    return learners;
  };

  return (
    <div className="users-page">
      <header className="users-header">
        <div>
          <h2>Mathalino</h2>
          <p>Administration Portal</p>
        </div>

        <button
          className="back-dashboard-button"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </button>
      </header>

      <main className="users-content">
        <div className="users-title">
          <h1>User Accounts</h1>
          <p>
            View registered teacher, guardian, and learner accounts.
          </p>
        </div>

        <div className="user-tabs">
          {(["Teachers", "Guardians", "Learners"] as UserRole[]).map(
            (role) => (
              <button
                key={role}
                className={activeTab === role ? "tab active-tab" : "tab"}
                onClick={() => setActiveTab(role)}
              >
                {role}
              </button>
            )
          )}
        </div>

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / Username</th>
                <th>Status</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {getUsers().map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>

                  <td>
                    <span
                      className={
                        user.status === "Active"
                          ? "status active-status"
                          : "status inactive-status"
                      }
                    >
                      {user.status}
                    </span>
                  </td>

                  <td>{user.lastLogin}</td>

                  <td>
                    <button
                      className="view-details-button"
                      onClick={() =>
                        navigate(`/users/${user.id}`, {
                          state: {
                            user,
                            role: activeTab,
                          },
                        })
                      }
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="temporary-data-note">
          Temporary sample data is being used until Firebase is connected.
        </p>
      </main>
    </div>
  );
}

export default UserAccountsPage;