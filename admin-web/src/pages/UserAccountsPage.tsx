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

type UserTab = "Learners" | "Teachers" | "Guardians";

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
    return timestamp.toDate().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
      <span className="account-status account-status-active">
        Active
      </span>
    );
  }

  if (normalizedStatus === "inactive") {
    return (
      <span className="account-status account-status-inactive">
        Inactive
      </span>
    );
  }

  return <span className="account-muted">—</span>;
}

function UserAccountsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState<UserTab>("Learners");

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
          snapshot = await getDocs(
            query(
              collection(db, "users"),
              where("role", "==", "teacher")
            )
          );
        } else if (activeTab === "Guardians") {
          snapshot = await getDocs(
            query(
              collection(db, "users"),
              where("role", "==", "guardian")
            )
          );
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
          "Unable to load user accounts."
        );
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
  }, [activeTab]);

  const renderEmptyState = () => (
    <tr>
      <td
        colSpan={5}
        className="accounts-empty"
      >
        No {activeTab.toLowerCase()} found.
      </td>
    </tr>
  );

  const renderLearners = () => (
    <table className="accounts-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Account Status</th>
          <th>Registered</th>
          <th></th>
        </tr>
      </thead>

      <tbody>
        {accounts.length === 0
          ? renderEmptyState()
          : accounts.map((account) => (
              <tr key={account.id}>
                <td className="account-name">
                  {account.name}
                </td>

                <td>Learner</td>

                <td>
                  {renderStatus(account.status)}
                </td>

                <td>{account.registered}</td>

                <td>
                  <button
                    type="button"
                    className="account-details-button"
                    onClick={() =>
                      navigate(
                        `/users/${account.id}`
                      )
                    }
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  );

  const renderTeachers = () => (
    <table className="accounts-table">
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
        {accounts.length === 0
          ? renderEmptyState()
          : accounts.map((account) => (
              <tr key={account.id}>
                <td className="account-name">
                  {account.name}
                </td>

                <td>{account.email}</td>

                <td>{account.school}</td>

                <td>{account.registered}</td>

                <td>
                  <button
                    type="button"
                    className="account-details-button"
                    onClick={() =>
                      navigate(
                        `/users/${account.id}`
                      )
                    }
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  );

  const renderGuardians = () => (
    <table className="accounts-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Email</th>
          <th>Registered</th>
          <th></th>
        </tr>
      </thead>

      <tbody>
        {accounts.length === 0
          ? renderEmptyState()
          : accounts.map((account) => (
              <tr key={account.id}>
                <td className="account-name">
                  {account.name}
                </td>

                <td>Guardian</td>

                <td>{account.email}</td>

                <td>{account.registered}</td>

                <td>
                  <button
                    type="button"
                    className="account-details-button"
                    onClick={() =>
                      navigate(
                        `/users/${account.id}`
                      )
                    }
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  );

  const renderTable = () => {
    if (activeTab === "Learners") {
      return renderLearners();
    }

    if (activeTab === "Teachers") {
      return renderTeachers();
    }

    return renderGuardians();
  };

  return (
    <div className="accounts-page">
      <div className="accounts-shell">
        <div className="accounts-card">

          <div className="accounts-header">
            <div>
              <span className="accounts-eyebrow">
                ADMINISTRATOR · VIEW ONLY
              </span>

              <h1>User accounts</h1>
            </div>

            <button
              type="button"
              className="accounts-back-button"
              onClick={() =>
                navigate("/dashboard")
              }
            >
              Back
            </button>
          </div>

          <div
            className="accounts-tabs"
            role="tablist"
            aria-label="User account type"
          >
            {(
              [
                "Learners",
                "Teachers",
                "Guardians",
              ] as UserTab[]
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={
                  activeTab === tab
                }
                className={
                  activeTab === tab
                    ? "accounts-tab accounts-tab-active"
                    : "accounts-tab"
                }
                onClick={() =>
                  setActiveTab(tab)
                }
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="accounts-table-wrapper">
            {loading && (
              <div className="accounts-message">
                Loading{" "}
                {activeTab.toLowerCase()}...
              </div>
            )}

            {!loading && error && (
              <div className="accounts-message accounts-error">
                {error}
              </div>
            )}

            {!loading &&
              !error &&
              renderTable()}
          </div>

        </div>
      </div>
    </div>
  );
}

export default UserAccountsPage;