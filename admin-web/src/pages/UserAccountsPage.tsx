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
  school: string;
  status: string;
  registered: string;
}

function formatTimestamp(value: unknown): string {
  if (!value) {
    return "—";
  }

  const timestamp = value as Timestamp;

  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate().toLocaleDateString();
  }

  return "—";
}

function getDisplayName(data: DocumentData): string {
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

function renderStatus(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "active") {
    return (
      <span className="status active-status">
        {status}
      </span>
    );
  }

  if (normalizedStatus === "inactive") {
    return (
      <span className="status inactive-status">
        {status}
      </span>
    );
  }

  return status;
}

function UserAccountsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState<UserTab>("Teachers");

  const [accounts, setAccounts] =
    useState<AccountRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoading(true);
        setError("");

        let snapshot;

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

              school:
                data.school ??
                "—",

              status:
                data.status ??
                data.accountStatus ??
                "—",

              registered:
                formatTimestamp(data.createdAt),
            };
          });

        setAccounts(accountList);
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

    loadAccounts();
  }, [activeTab]);

  const renderTeachersTable = () => {
    return (
      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>School</th>
            <th>Registered</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>{account.name}</td>

              <td>{account.email}</td>

              <td>{account.school}</td>

              <td>{account.registered}</td>

              <td>
                <button
                  type="button"
                  className="view-details-button"
                  onClick={() =>
                    navigate(`/users/${account.id}`)
                  }
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderGuardiansTable = () => {
    return (
      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Registered</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>{account.name}</td>

              <td>{account.email}</td>

              <td>{account.registered}</td>

              <td>
                <button
                  type="button"
                  className="view-details-button"
                  onClick={() =>
                    navigate(`/users/${account.id}`)
                  }
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderLearnersTable = () => {
    return (
      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Registered</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>{account.name}</td>

              <td>{renderStatus(account.status)}</td>

              <td>{account.registered}</td>

              <td>
                <button
                  type="button"
                  className="view-details-button"
                  onClick={() =>
                    navigate(`/users/${account.id}`)
                  }
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderTable = () => {
    if (accounts.length === 0) {
      return (
        <div className="users-table-container">
          <p
            style={{
              textAlign: "center",
              padding: "30px",
              color: "#6b7280",
            }}
          >
            No {activeTab.toLowerCase()} found.
          </p>
        </div>
      );
    }

    return (
      <div className="users-table-container">
        {activeTab === "Teachers" &&
          renderTeachersTable()}

        {activeTab === "Guardians" &&
          renderGuardiansTable()}

        {activeTab === "Learners" &&
          renderLearnersTable()}
      </div>
    );
  };

  return (
    <div className="users-page">
      <header className="users-header">
        <div>
          <h2>Mathalino</h2>
          <p>Administration Portal</p>
        </div>

        <button
          type="button"
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
            View registered teacher, guardian,
            and learner accounts.
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
              type="button"
              key={tab}
              className={
                activeTab === tab
                  ? "tab active-tab"
                  : "tab"
              }
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading && (
          <div className="users-table-container">
            <p
              style={{
                textAlign: "center",
                padding: "30px",
                color: "#6b7280",
              }}
            >
              Loading {activeTab.toLowerCase()}...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="users-table-container">
            <p
              style={{
                textAlign: "center",
                padding: "30px",
                color: "#b42318",
              }}
            >
              {error}
            </p>
          </div>
        )}

        {!loading && !error && renderTable()}
      </main>
    </div>
  );
}

export default UserAccountsPage;