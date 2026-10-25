import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  onSnapshot,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import mathalinoLogo from "../assets/mathalino-logo.png";

import "./DashboardPage.css";

type AccountRole =
  | "teacher"
  | "guardian"
  | "learner";

interface AccountRecord {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  status: string;
  createdAt: unknown;
}

function getAccountName(
  data: DocumentData,
  fallback = "Mathalino User"
): string {
  if (
    typeof data.fullName === "string" &&
    data.fullName.trim()
  ) {
    return data.fullName.trim();
  }

  if (
    typeof data.displayName === "string" &&
    data.displayName.trim()
  ) {
    return data.displayName.trim();
  }

  if (
    typeof data.name === "string" &&
    data.name.trim()
  ) {
    return data.name.trim();
  }

  const composedName = [
    data.firstName,
    data.middleInitial,
    data.lastName,
  ]
    .filter(
      (value) =>
        typeof value === "string" &&
        value.trim()
    )
    .map(
      (value) =>
        String(value).trim()
    )
    .join(" ");

  return composedName || fallback;
}

function normalizeStatus(
  value: unknown
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return "active";
  }

  return value
    .trim()
    .toLowerCase();
}

function timestampMillis(
  value: unknown
): number {
  if (!value) {
    return 0;
  }

  const timestamp =
    value as Timestamp;

  if (
    typeof timestamp?.toMillis ===
    "function"
  ) {
    return timestamp.toMillis();
  }

  if (
    typeof timestamp?.toDate ===
    "function"
  ) {
    return timestamp
      .toDate()
      .getTime();
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const parsed =
      new Date(value).getTime();

    return Number.isNaN(parsed)
      ? 0
      : parsed;
  }

  return 0;
}

function formatDate(
  value: unknown
): string {
  if (!value) {
    return "—";
  }

  const timestamp =
    value as Timestamp;

  let date: Date | null = null;

  if (
    typeof timestamp?.toDate ===
    "function"
  ) {
    date = timestamp.toDate();
  } else if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const parsed =
      new Date(value);

    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      date = parsed;
    }
  }

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function roleLabel(
  role: AccountRole
): string {
  if (role === "teacher") {
    return "Teacher";
  }

  if (role === "guardian") {
    return "Guardian";
  }

  return "Learner";
}

/* =========================
   ICONS
   ========================= */

function DashboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1.5"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1.5"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1.5"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1.5"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle
        cx="9"
        cy="7"
        r="4"
      />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TeacherIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 5h18" />
      <path d="M5 5v12h14V5" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M8 10h3" />
      <path d="M8 13h7" />
    </svg>
  );
}

function GuardianIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 4.5 6v5.5c0 4.8 3.1 8 7.5 9.5 4.4-1.5 7.5-4.7 7.5-9.5V6L12 3Z" />
      <circle
        cx="12"
        cy="10"
        r="2.2"
      />
      <path d="M8.7 16c.7-1.5 1.8-2.3 3.3-2.3s2.6.8 3.3 2.3" />
    </svg>
  );
}

function LearnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 10 9-5 9 5-9 5-9-5Z" />
      <path d="M7 12.2V17c2.7 2.1 7.3 2.1 10 0v-4.8" />
      <path d="M21 10v6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle
        cx="12"
        cy="12"
        r="2.5"
      />
    </svg>
  );
}

/* =========================
   PAGE
   ========================= */

function DashboardPage() {
  const navigate =
    useNavigate();

  const [
    adminName,
    setAdminName,
  ] = useState(
    "Administrator"
  );

  const [
    userAccounts,
    setUserAccounts,
  ] = useState<
    AccountRecord[]
  >([]);

  const [
    learnerAccounts,
    setLearnerAccounts,
  ] = useState<
    AccountRecord[]
  >([]);

  const [
    usersLoaded,
    setUsersLoaded,
  ] = useState(false);

  const [
    learnersLoaded,
    setLearnersLoaded,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let unsubscribeAdmin:
      | (() => void)
      | null = null;

    let unsubscribeUsers:
      | (() => void)
      | null = null;

    let unsubscribeLearners:
      | (() => void)
      | null = null;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        (user) => {
          if (
            unsubscribeAdmin
          ) {
            unsubscribeAdmin();
            unsubscribeAdmin = null;
          }

          if (
            unsubscribeUsers
          ) {
            unsubscribeUsers();
            unsubscribeUsers = null;
          }

          if (
            unsubscribeLearners
          ) {
            unsubscribeLearners();
            unsubscribeLearners =
              null;
          }

          if (!user) {
            navigate(
              "/",
              {
                replace: true,
              }
            );

            return;
          }

          /* ADMIN PROFILE */

          unsubscribeAdmin =
            onSnapshot(
              doc(
                db,
                "users",
                user.uid
              ),
              (
                snapshot
              ) => {
                if (
                  !snapshot.exists()
                ) {
                  return;
                }

                const data =
                  snapshot.data();

                const role =
                  String(
                    data.role ??
                      ""
                  )
                    .trim()
                    .toLowerCase();

                if (
                  role !==
                  "admin"
                ) {
                  navigate(
                    "/",
                    {
                      replace:
                        true,
                    }
                  );

                  return;
                }

                setAdminName(
                  getAccountName(
                    data,
                    "Administrator"
                  )
                );
              },
              (
                profileError
              ) => {
                console.error(
                  "Unable to load administrator profile:",
                  profileError
                );
              }
            );

          /* TEACHER + GUARDIAN ACCOUNTS */

          unsubscribeUsers =
            onSnapshot(
              collection(
                db,
                "users"
              ),
              (
                snapshot
              ) => {
                const accounts:
                  AccountRecord[] =
                    [];

                snapshot.docs.forEach(
                  (
                    document
                  ) => {
                    const data =
                      document.data();

                    const role =
                      String(
                        data.role ??
                          ""
                      )
                        .trim()
                        .toLowerCase();

                    if (
                      role !==
                        "teacher" &&
                      role !==
                        "guardian"
                    ) {
                      return;
                    }

                    accounts.push({
                      id:
                        document.id,

                      name:
                        getAccountName(
                          data
                        ),

                      email:
                        typeof data.email ===
                        "string"
                          ? data.email
                          : "",

                      role:
                        role as AccountRole,

                      status:
                        normalizeStatus(
                          data.status
                        ),

                      createdAt:
                        data.createdAt ??
                        null,
                    });
                  }
                );

                setUserAccounts(
                  accounts
                );

                setUsersLoaded(
                  true
                );

                setError("");
              },
              (
                snapshotError
              ) => {
                console.error(
                  "Unable to load Mathalino users:",
                  snapshotError
                );

                setUsersLoaded(
                  true
                );

                setError(
                  "Some account information could not be loaded."
                );
              }
            );

          /* LEARNER ACCOUNTS */

          unsubscribeLearners =
            onSnapshot(
              collection(
                db,
                "learners"
              ),
              (
                snapshot
              ) => {
                const learners:
                  AccountRecord[] =
                    snapshot.docs.map(
                      (
                        document
                      ) => {
                        const data =
                          document.data();

                        return {
                          id:
                            document.id,

                          name:
                            getAccountName(
                              data,
                              "Learner"
                            ),

                          email:
                            typeof data.email ===
                            "string"
                              ? data.email
                              : "",

                          role:
                            "learner",

                          status:
                            normalizeStatus(
                              data.status
                            ),

                          createdAt:
                            data.createdAt ??
                            null,
                        };
                      }
                    );

                setLearnerAccounts(
                  learners
                );

                setLearnersLoaded(
                  true
                );
              },
              (
                snapshotError
              ) => {
                console.error(
                  "Unable to load Mathalino learners:",
                  snapshotError
                );

                setLearnersLoaded(
                  true
                );

                setError(
                  "Some account information could not be loaded."
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      if (
        unsubscribeAdmin
      ) {
        unsubscribeAdmin();
      }

      if (
        unsubscribeUsers
      ) {
        unsubscribeUsers();
      }

      if (
        unsubscribeLearners
      ) {
        unsubscribeLearners();
      }
    };
  }, [navigate]);

  const teacherCount =
    useMemo(
      () =>
        userAccounts.filter(
          (account) =>
            account.role ===
            "teacher"
        ).length,
      [userAccounts]
    );

  const guardianCount =
    useMemo(
      () =>
        userAccounts.filter(
          (account) =>
            account.role ===
            "guardian"
        ).length,
      [userAccounts]
    );

  const learnerCount =
    learnerAccounts.length;

  const totalAccounts =
    teacherCount +
    guardianCount +
    learnerCount;

  const recentAccounts =
    useMemo(
      () =>
        [
          ...userAccounts,
          ...learnerAccounts,
        ]
          .sort(
            (
              first,
              second
            ) =>
              timestampMillis(
                second.createdAt
              ) -
              timestampMillis(
                first.createdAt
              )
          )
          .slice(
            0,
            5
          ),
      [
        userAccounts,
        learnerAccounts,
      ]
    );

  const loading =
    !usersLoaded ||
    !learnersLoaded;

  const handleLogout =
    async () => {
      try {
        await signOut(
          auth
        );

        navigate(
          "/",
          {
            replace: true,
          }
        );
      } catch (
        logoutError
      ) {
        console.error(
          "Administrator logout failed:",
          logoutError
        );
      }
    };

  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-layout">

        {/* =====================
            SIDEBAR
        ====================== */}

        <aside className="admin-dashboard-sidebar">

          <div>
            <div className="admin-dashboard-brand">
              <img
                src={
                  mathalinoLogo
                }
                alt="Mathalino Logo"
                className="admin-dashboard-logo"
              />

              <div>
                <h1>
                  Mathalino
                </h1>

                <p>
                  LEARN BY DOING
                </p>
              </div>
            </div>

            <nav className="admin-dashboard-nav">

              <button
                type="button"
                className="admin-dashboard-nav-item active"
                onClick={() =>
                  navigate(
                    "/dashboard"
                  )
                }
              >
                <span className="admin-dashboard-nav-icon">
                  <DashboardIcon />
                </span>

                <span>
                  Dashboard
                </span>
              </button>

              <button
                type="button"
                className="admin-dashboard-nav-item"
                onClick={() =>
                  navigate(
                    "/users"
                  )
                }
              >
                <span className="admin-dashboard-nav-icon">
                  <UsersIcon />
                </span>

                <span>
                  User Accounts
                </span>
              </button>

            </nav>
          </div>

          <div className="admin-dashboard-sidebar-bottom">

            <div className="admin-dashboard-access-note">
              <div className="admin-dashboard-access-icon">
                <EyeIcon />
              </div>

              <div>
                <strong>
                  Administrator
                </strong>

                <span>
                  View-only account
                  oversight
                </span>
              </div>
            </div>

            <button
              type="button"
              className="admin-dashboard-logout"
              onClick={() => {
                void handleLogout();
              }}
            >
              <LogoutIcon />

              <span>
                Log out
              </span>
            </button>

          </div>

        </aside>

        {/* =====================
            MAIN
        ====================== */}

        <main className="admin-dashboard-main">

          {/* HEADER */}

          <header className="admin-dashboard-header">

            <div>
              <span className="admin-dashboard-eyebrow">
                ADMINISTRATOR PORTAL
              </span>

              <h2>
                Welcome back,{" "}
                {adminName}.
              </h2>

              <p>
                View registered
                Mathalino accounts
                and monitor the
                platform's user
                directory.
              </p>
            </div>

            <div className="admin-dashboard-readonly">
              <EyeIcon />

              <span>
                View-only access
              </span>
            </div>

          </header>

          {error && (
            <div
              className="admin-dashboard-alert"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* OVERVIEW */}

          <section className="admin-dashboard-section">

            <div className="admin-dashboard-section-heading">
              <div>
                <span>
                  OVERVIEW
                </span>

                <h3>
                  Account summary
                </h3>
              </div>

              <p>
                Real-time registered
                account totals.
              </p>
            </div>

            <div className="admin-dashboard-stats">

              <div className="admin-dashboard-stat-card">
                <div className="admin-dashboard-stat-top">
                  <div className="admin-dashboard-stat-icon total">
                    <UsersIcon />
                  </div>

                  <span className="admin-dashboard-stat-label">
                    Total accounts
                  </span>
                </div>

                <strong>
                  {loading
                    ? "—"
                    : totalAccounts}
                </strong>

                <p>
                  Teachers, guardians
                  and learners
                </p>
              </div>

              <div className="admin-dashboard-stat-card">
                <div className="admin-dashboard-stat-top">
                  <div className="admin-dashboard-stat-icon teacher">
                    <TeacherIcon />
                  </div>

                  <span className="admin-dashboard-stat-label">
                    Teachers
                  </span>
                </div>

                <strong>
                  {loading
                    ? "—"
                    : teacherCount}
                </strong>

                <p>
                  Registered teacher
                  accounts
                </p>
              </div>

              <div className="admin-dashboard-stat-card">
                <div className="admin-dashboard-stat-top">
                  <div className="admin-dashboard-stat-icon guardian">
                    <GuardianIcon />
                  </div>

                  <span className="admin-dashboard-stat-label">
                    Guardians
                  </span>
                </div>

                <strong>
                  {loading
                    ? "—"
                    : guardianCount}
                </strong>

                <p>
                  Registered guardian
                  accounts
                </p>
              </div>

              <div className="admin-dashboard-stat-card">
                <div className="admin-dashboard-stat-top">
                  <div className="admin-dashboard-stat-icon learner">
                    <LearnerIcon />
                  </div>

                  <span className="admin-dashboard-stat-label">
                    Learners
                  </span>
                </div>

                <strong>
                  {loading
                    ? "—"
                    : learnerCount}
                </strong>

                <p>
                  Teacher-created
                  learner profiles
                </p>
              </div>

            </div>

          </section>

          {/* QUICK ACCESS */}

          <section className="admin-dashboard-section">

            <div className="admin-dashboard-section-heading">
              <div>
                <span>
                  QUICK ACCESS
                </span>

                <h3>
                  Administration
                </h3>
              </div>
            </div>

            <div className="admin-dashboard-quick-grid">

              <button
                type="button"
                className="admin-dashboard-quick-card primary"
                onClick={() =>
                  navigate(
                    "/users"
                  )
                }
              >
                <div className="admin-dashboard-quick-icon">
                  <UsersIcon />
                </div>

                <div className="admin-dashboard-quick-content">
                  <span>
                    ACCOUNT DIRECTORY
                  </span>

                  <h4>
                    User Accounts
                  </h4>

                  <p>
                    Browse registered
                    learners, teachers
                    and guardians and
                    review their
                    account details.
                  </p>
                </div>

                <div className="admin-dashboard-quick-arrow">
                  <ArrowIcon />
                </div>
              </button>

              <div className="admin-dashboard-scope-card">

                <div className="admin-dashboard-scope-heading">
                  <div className="admin-dashboard-scope-icon">
                    <EyeIcon />
                  </div>

                  <div>
                    <span>
                      ACCESS SCOPE
                    </span>

                    <h4>
                      Account oversight
                    </h4>
                  </div>
                </div>

                <p>
                  Administrator access
                  is limited to viewing
                  registered account
                  information.
                </p>

                <div className="admin-dashboard-scope-list">

                  <div>
                    <span className="admin-dashboard-check">
                      ✓
                    </span>

                    View teacher
                    accounts
                  </div>

                  <div>
                    <span className="admin-dashboard-check">
                      ✓
                    </span>

                    View guardian
                    accounts
                  </div>

                  <div>
                    <span className="admin-dashboard-check">
                      ✓
                    </span>

                    View learner
                    accounts
                  </div>

                </div>

              </div>

            </div>

          </section>

          {/* RECENT ACCOUNTS */}

          <section className="admin-dashboard-section">

            <div className="admin-dashboard-section-heading recent-heading">

              <div>
                <span>
                  RECENT RECORDS
                </span>

                <h3>
                  Recently registered
                </h3>
              </div>

              <button
                type="button"
                className="admin-dashboard-view-all"
                onClick={() =>
                  navigate(
                    "/users"
                  )
                }
              >
                View all accounts

                <ArrowIcon />
              </button>

            </div>

            <div className="admin-dashboard-recent-card">

              {loading && (
                <div className="admin-dashboard-empty">
                  Loading account
                  records...
                </div>
              )}

              {!loading &&
                recentAccounts.length ===
                  0 && (
                  <div className="admin-dashboard-empty">
                    No account records
                    are available yet.
                  </div>
                )}

              {!loading &&
                recentAccounts.length >
                  0 && (
                  <div className="admin-dashboard-table-wrapper">

                    <table className="admin-dashboard-table">

                      <thead>
                        <tr>
                          <th>
                            Account
                          </th>

                          <th>
                            Role
                          </th>

                          <th>
                            Status
                          </th>

                          <th>
                            Added
                          </th>
                        </tr>
                      </thead>

                      <tbody>

                        {recentAccounts.map(
                          (
                            account
                          ) => (
                            <tr
                              key={`${account.role}-${account.id}`}
                            >
                              <td>
                                <div className="admin-dashboard-account-cell">

                                  <div
                                    className={`admin-dashboard-account-avatar ${account.role}`}
                                  >
                                    {account.name
                                      .charAt(
                                        0
                                      )
                                      .toUpperCase()}
                                  </div>

                                  <div>
                                    <strong>
                                      {
                                        account.name
                                      }
                                    </strong>

                                    <span>
                                      {account.email ||
                                        "No email listed"}
                                    </span>
                                  </div>

                                </div>
                              </td>

                              <td>
                                <span
                                  className={`admin-dashboard-role-badge ${account.role}`}
                                >
                                  {roleLabel(
                                    account.role
                                  )}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={`admin-dashboard-status ${account.status}`}
                                >
                                  <span />

                                  {
                                    account.status
                                  }
                                </span>
                              </td>

                              <td>
                                {formatDate(
                                  account.createdAt
                                )}
                              </td>
                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>
                )}

            </div>

          </section>

        </main>

      </div>
    </div>
  );
}

export default DashboardPage;