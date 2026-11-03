import type {
  ReactNode,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router";

import {
  signOut,
} from "firebase/auth";

import {
  auth,
} from "../firebase/firebase";

import {
  useRfidAutoStart,
} from "../hooks/useRfidAutoStart";

import {
  useAnswerSubmissionProcessing,
} from "../hooks/useAnswerSubmissionProcessing";

import {
  useResultSynchronization,
} from "../hooks/useResultSynchronization";

import mathalinoLogo from "../assets/mathalino-logo.png";

import "./TeacherLayout.css";

interface TeacherLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  label: string;
  path: string;
}

const navigationItems:
  NavigationItem[] = [
    {
      label: "Dashboard",
      path: "/teacher-dashboard",
    },

    {
      label: "My Learners",
      path: "/teacher/learners",
    },

    {
      label: "Assign Activity",
      path: "/teacher/assign-activity",
    },

    {
      label: "Activities",
      path: "/teacher/activities",
    },

    {
      label: "Guardian Requests",
      path: "/teacher/guardian-requests",
    },

    {
      label: "Smart Boards",
      path: "/teacher/boards",
    },

    {
      label: "Live Sessions",
      path: "/teacher/live-sessions",
    },

    {
      label: "Account",
      path: "/teacher/account",
    },
  ];

function TeacherLayout({
  children,
}: Readonly<TeacherLayoutProps>) {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  useRfidAutoStart();

  useAnswerSubmissionProcessing();

  useResultSynchronization();

  const handleLogout =
    async () => {
      try {
        await signOut(
          auth
        );

        navigate(
          "/"
        );
      } catch (
        error
      ) {
        console.error(
          "Teacher logout error:",
          error
        );
      }
    };

  const isActive = (
    path: string
  ) => {
    return (
      location.pathname ===
      path
    );
  };

  return (
    <div className="teacher-layout-page">

      <div className="teacher-layout-container">

        <aside className="teacher-layout-sidebar">

          <button
            type="button"
            className="teacher-layout-brand"
            aria-label="Go to Mathalino teacher dashboard"
            onClick={() =>
              navigate(
                "/teacher-dashboard"
              )
            }
          >

            <img
              src={
                mathalinoLogo
              }
              alt=""
              className="teacher-layout-logo"
            />

            <div className="teacher-layout-brand-text">

              <h1>
                Mathalino
              </h1>

              <p>
                LEARN BY DOING
              </p>

            </div>

          </button>

          <nav className="teacher-layout-nav">

            {navigationItems.map(
              (
                item
              ) => (
                <button
                  key={
                    item.path
                  }
                  type="button"
                  className={
                    isActive(
                      item.path
                    )
                      ? "teacher-layout-nav-item active"
                      : "teacher-layout-nav-item"
                  }
                  onClick={() =>
                    navigate(
                      item.path
                    )
                  }
                >
                  {
                    item.label
                  }
                </button>
              )
            )}

          </nav>

          <button
            type="button"
            className="teacher-layout-logout"
            onClick={() => {
              void handleLogout();
            }}
          >
            Log out
          </button>

        </aside>

        <main className="teacher-layout-content">

          {children}

        </main>

      </div>

    </div>
  );
}

export default TeacherLayout;