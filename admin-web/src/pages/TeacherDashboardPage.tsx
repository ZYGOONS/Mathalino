import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import TeacherLayout from "../components/TeacherLayout";

import "./TeacherDashboardPage.css";

interface TeacherProfile {
  name: string;
  school: string;
}

interface DashboardCounts {
  learners: number;
  activities: number;
  guardianRequests: number;
}

function getTeacherName(
  data: Record<string, unknown>
): string {
  if (
    typeof data.fullName === "string" &&
    data.fullName.trim()
  ) {
    return data.fullName;
  }

  if (
    typeof data.displayName === "string" &&
    data.displayName.trim()
  ) {
    return data.displayName;
  }

  const firstName =
    typeof data.firstName === "string"
      ? data.firstName
      : "";

  const middleInitial =
    typeof data.middleInitial === "string"
      ? data.middleInitial
      : "";

  const lastName =
    typeof data.lastName === "string"
      ? data.lastName
      : "";

  const name = [
    firstName,
    middleInitial,
    lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return name || "Teacher";
}

function TeacherDashboardPage() {
  const navigate = useNavigate();

  const [teacher, setTeacher] =
    useState<TeacherProfile>({
      name: "Teacher",
      school: "",
    });

  const [counts, setCounts] =
    useState<DashboardCounts>({
      learners: 0,
      activities: 0,
      guardianRequests: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadDashboard = async (
      user: User
    ) => {
      try {
        setLoading(true);
        setError("");

        const teacherReference =
          doc(
            db,
            "users",
            user.uid
          );

        const teacherSnapshot =
          await getDoc(
            teacherReference
          );

        if (!teacherSnapshot.exists()) {
          throw new Error(
            "Teacher profile not found."
          );
        }

        const teacherData =
          teacherSnapshot.data();

        const learnersQuery =
          query(
            collection(
              db,
              "learners"
            ),
            where(
              "teacherId",
              "==",
              user.uid
            )
          );

        const activitiesQuery =
          query(
            collection(
              db,
              "activities"
            ),
            where(
              "teacherId",
              "==",
              user.uid
            )
          );

        const requestsQuery =
          query(
            collection(
              db,
              "guardianRequests"
            ),
            where(
              "teacherId",
              "==",
              user.uid
            )
          );

        const [
          learnersSnapshot,
          activitiesSnapshot,
          requestsSnapshot,
        ] = await Promise.all([
          getDocs(
            learnersQuery
          ),
          getDocs(
            activitiesQuery
          ),
          getDocs(
            requestsQuery
          ),
        ]);

        const pendingRequests =
          requestsSnapshot.docs.filter(
            (document) =>
              document.data()
                .status ===
              "pending"
          ).length;

        if (!active) {
          return;
        }

        setTeacher({
          name:
            getTeacherName(
              teacherData
            ),

          school:
            teacherData.school ??
            "",
        });

        setCounts({
          learners:
            learnersSnapshot.size,

          activities:
            activitiesSnapshot.size,

          guardianRequests:
            pendingRequests,
        });
      } catch (loadError) {
        console.error(
          "Teacher dashboard error:",
          loadError
        );

        if (active) {
          setError(
            "Unable to load teacher dashboard information."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            navigate("/");
            return;
          }

          void loadDashboard(
            user
          );
        }
      );

    return () => {
      active = false;

      unsubscribe();
    };
  }, [navigate]);

  const initial =
    teacher.name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "T";

  return (
    <TeacherLayout>

      <header className="teacher-header">

        <div>

          <span className="teacher-eyebrow">
            TEACHER PORTAL
          </span>

          <h2>
            Welcome back,{" "}
            {teacher.name}.
          </h2>

          <p>
            Manage your learners and
            classroom activities in
            Mathalino.
          </p>

        </div>

        <button
          type="button"
          className="teacher-profile"
          aria-label="Open teacher account"
          onClick={() =>
            navigate(
              "/teacher/account"
            )
          }
        >

          <div className="teacher-avatar">
            {initial}
          </div>

          <div className="teacher-profile-info">

            <strong>
              {teacher.name}
            </strong>

            <span>
              {teacher.school ||
                "Mathalino Teacher"}
            </span>

          </div>

        </button>

      </header>

      {error && (
        <div
          className="teacher-development-note"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="teacher-summary">

        <div className="teacher-summary-card">

          <span>
            MY LEARNERS
          </span>

          <strong>
            {loading
              ? "—"
              : counts.learners}
          </strong>

          <p>
            Registered learners
          </p>

        </div>

        <div className="teacher-summary-card">

          <span>
            ACTIVITIES
          </span>

          <strong>
            {loading
              ? "—"
              : counts.activities}
          </strong>

          <p>
            Created activities
          </p>

        </div>

        <div className="teacher-summary-card">

          <span>
            GUARDIAN REQUESTS
          </span>

          <strong>
            {loading
              ? "—"
              : counts.guardianRequests}
          </strong>

          <p>
            Pending requests
          </p>

        </div>

      </section>

      <section className="teacher-content-card">

        <div className="teacher-section-heading">

          <span className="teacher-eyebrow">
            QUICK ACCESS
          </span>

          <h3>
            Classroom Management
          </h3>

        </div>

        <div className="teacher-actions">

          <button
            type="button"
            className="teacher-action-card"
            onClick={() =>
              navigate(
                "/teacher/learners"
              )
            }
          >

            <div className="teacher-action-icon">
              👥
            </div>

            <div>
              <h4>
                My Learners
              </h4>

              <p>
                View learners assigned
                to your account.
              </p>
            </div>

          </button>

          <button
            type="button"
            className="teacher-action-card"
            onClick={() =>
              navigate(
                "/teacher/activities"
              )
            }
          >

            <div className="teacher-action-icon">
              ✎
            </div>

            <div>
              <h4>
                Activities
              </h4>

              <p>
                View and manage your
                learning activities.
              </p>
            </div>

          </button>

          <button
            type="button"
            className="teacher-action-card"
            onClick={() =>
              navigate(
                "/teacher/guardian-requests"
              )
            }
          >

            <div className="teacher-action-icon">
              ✓
            </div>

            <div>
              <h4>
                Guardian Requests
              </h4>

              <p>
                Review pending guardian
                access requests.
              </p>
            </div>

          </button>

        </div>

      </section>

    </TeacherLayout>
  );
}

export default TeacherDashboardPage;