import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import "./UserAccountsPage.css";

type UserTab = "Teachers" | "Guardians" | "Learners";

interface AccountRow {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLogin: string;
  role: string;
  rawData: DocumentData;
}

function UserAccountsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState<UserTab>("Teachers");

  const [users, setUsers] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatTimestamp = (value: unknown) => {
    if (!value) {
      return "—";
    }

    const timestamp = value as Timestamp;

    if (typeof timestamp?.toDate === "function") {
      return timestamp.toDate().toLocaleDateString();
    }

    return "—";
  };

  const getDisplayName = (data: DocumentData) => {
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
  };

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError("");

      let snapshot;

      /*
       * Teachers and Guardians are stored
       * inside the "users" collection.
       *
       * Learners are stored separately
       * inside the "learners" collection.
       */

      if (activeTab === "Teachers") {
        const teacherQuery = query(
          collection(db, "users"),
          where("role", "==", "teacher")
        );

        snapshot = await getDocs(teacherQuery);
      } else if (activeTab === "Guardians") {
        const guardianQuery = query(
          collection(db, "users"),
          where("role", "==", "guardian")
        );

        snapshot = await getDocs(guardianQuery);
      } else {
        snapshot = await getDocs(
          collection(db, "learners")
        );
      }

      const accountList: AccountRow[] =
        snapshot.docs.map((document) => {
          const data = document.data();

          return {
            id: document.id,

            name: getDisplayName(data),

            email:
              data.email ??
              data.username ??
              "—",

            /*
             * We only display these fields if
             * they actually exist in Firestore.
             */
            status:
              data.status ??
              data.accountStatus ??
              "—",

            lastLogin:
              formatTimestamp(data.lastLogin) !== "—"
                ? formatTimestamp(data.lastLogin)
                : formatTimestamp(data.createdAt),

            role:
              data.role ??
              (activeTab === "Learners"
                ? "learner"
                : "—"),

            rawData: data,
          };
        });

      setUsers(accountList);
    } catch (err) {
      console.error(
        "Error loading Firestore accounts:",
        err
      );

      setError(
        "Unable to load user accounts from Firebase."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [activeTab]);

  return (
    <div className="users-page">

      <header className="users-header">
        <div>
          <h2>Mathalino</h2>
          <p>Administration Portal</p>
        </div>

        <button
          className="back-dashboard-button"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          Back to Dashboard
        </button>
      </header>

      <main className="users-content">

        <div className="users-title">
          <h1>User Accounts</h1>

          <p>
            View registered teacher,
            guardian, and learner accounts.
          </p>
        </div>

        <div className="user-tabs">

          {(
            [
              "Teachers",
              "Guardians",
              "Learners",
            ] as UserTab[]
          ).map((tab) => (
            <button
              key={tab}
              className={
                activeTab === tab
                  ? "tab active-tab"
                  : "tab"
              }
              onClick={() =>
                setActiveTab(tab)
              }
            >
              {tab}
            </button>
          ))}

        </div>

        {loading && (
          <div className="users-table-container">
            <p
              style={{
                padding: "30px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              Loading {activeTab.toLowerCase()}...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="users-table-container">
            <p
              style={{
                padding: "30px",
                textAlign: "center",
                color: "#b42318",
              }}
            >
              {error}
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="users-table-container">

            <table className="users-table">

              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email / Username</th>
                  <th>Status</th>
                  <th>
                    Registered / Last Login
                  </th>
                  <th></th>
                </tr>
              </thead>

              <tbody>

                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: "30px",
                        color: "#6b7280",
                      }}
                    >
                      No {activeTab.toLowerCase()}
                      {" "}found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>

                      <td>
                        {user.name}
                      </td>

                      <td>
                        {user.email}
                      </td>

                      <td>
                        {user.status === "Active" ||
                        user.status === "active" ? (
                          <span className="status active-status">
                            {user.status}
                          </span>
                        ) : user.status === "Inactive" ||
                          user.status === "inactive" ? (
                          <span className="status inactive-status">
                            {user.status}
                          </span>
                        ) : (
                          <span>
                            {user.status}
                          </span>
                        )}
                      </td>

                      <td>
                        {user.lastLogin}
                      </td>

                      <td>
                        <button
                          className="view-details-button"
                          onClick={() => navigate(`/users/${user.id}`)}
                        >
                          View Details
                        </button>
                      </td>

                    </tr>
                  ))
                )}

              </tbody>

            </table>

          </div>
        )}

      </main>
    </div>
  );
}

export default UserAccountsPage;