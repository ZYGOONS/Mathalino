import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import LoginPage from "./pages/LoginPage";

import DashboardPage from "./pages/DashboardPage";
import UserAccountsPage from "./pages/UserAccountsPage";
import UserDetailsPage from "./pages/UserDetailsPage";

import TeacherDashboardPage from "./pages/TeacherDashboardPage";

import TeacherLearnersPage from "./pages/TeacherLearnersPage";
import TeacherCreateLearnerPage from "./pages/TeacherCreateLearnerPage";
import TeacherLearnerDetailsPage from "./pages/TeacherLearnerDetailsPage";
import TeacherEditLearnerPage from "./pages/TeacherEditLearnerPage";
import TeacherLinkRfidPage from "./pages/TeacherLinkRfidPage";
import TeacherInvitationCodePage from "./pages/TeacherInvitationCodePage";
import TeacherLearnerAssignmentsPage from "./pages/TeacherLearnerAssignmentsPage";
import TeacherLearnerPerformancePage from "./pages/TeacherLearnerPerformancePage";
import TeacherSessionResultsPage from "./pages/TeacherSessionResultsPage";
import TeacherRecommendationHistoryPage from "./pages/TeacherRecommendationHistoryPage";

import TeacherAssignActivityPage from "./pages/TeacherAssignActivityPage";

import TeacherActivitiesPage from "./pages/TeacherActivitiesPage";
import TeacherCreateActivityPage from "./pages/TeacherCreateActivityPage";
import TeacherActivityDetailsPage from "./pages/TeacherActivityDetailsPage";
import TeacherEditActivityPage from "./pages/TeacherEditActivityPage";
import TeacherQuestionPreviewPage from "./pages/TeacherQuestionPreviewPage";

import TeacherGuardianRequestsPage from "./pages/TeacherGuardianRequestsPage";

import TeacherSmartBoardsPage from "./pages/TeacherSmartBoardsPage";
import TeacherLiveSessionsPage from "./pages/TeacherLiveSessionsPage";

import TeacherAccountPage from "./pages/TeacherAccountPage";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>

      {/* =====================
          LOGIN
          ===================== */}

      <Route
        path="/"
        element={
          <LoginPage />
        }
      />

      {/* =====================
          ADMIN
          ===================== */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute
            allowedRole="admin"
          >
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute
            allowedRole="admin"
          >
            <UserAccountsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users/:userId"
        element={
          <ProtectedRoute
            allowedRole="admin"
          >
            <UserDetailsPage />
          </ProtectedRoute>
        }
      />

      {/* =====================
          TEACHER DASHBOARD
          ===================== */}

      <Route
        path="/teacher-dashboard"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* =====================
          LEARNERS
          ===================== */}

      <Route
        path="/teacher/learners"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherLearnersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/create"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherCreateLearnerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/:learnerId/edit"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherEditLearnerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/:learnerId/rfid"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherLinkRfidPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/:learnerId/invitation"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherInvitationCodePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/:learnerId/assignments"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherLearnerAssignmentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/:learnerId/performance"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherLearnerPerformancePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/:learnerId/results"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherSessionResultsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/:learnerId/recommendation-history"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherRecommendationHistoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/learners/:learnerId"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherLearnerDetailsPage />
          </ProtectedRoute>
        }
      />

      {/* =====================
          ASSIGN ACTIVITY
          ===================== */}

      <Route
        path="/teacher/assign-activity"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherAssignActivityPage />
          </ProtectedRoute>
        }
      />

      {/* =====================
          ACTIVITIES
          ===================== */}

      <Route
        path="/teacher/activities"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherActivitiesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/activities/create"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherCreateActivityPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/activities/:activityId/edit"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherEditActivityPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/activities/:activityId/questions"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherQuestionPreviewPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/activities/:activityId"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherActivityDetailsPage />
          </ProtectedRoute>
        }
      />

      {/* =====================
          GUARDIAN REQUESTS
          ===================== */}

      <Route
        path="/teacher/guardian-requests"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherGuardianRequestsPage />
          </ProtectedRoute>
        }
      />

      {/* =====================
          SMART BOARDS
          ===================== */}

      <Route
        path="/teacher/boards"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherSmartBoardsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/live-sessions"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherLiveSessionsPage />
          </ProtectedRoute>
        }
      />

      {/* =====================
          ACCOUNT
          ===================== */}

      <Route
        path="/teacher/account"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherAccountPage />
          </ProtectedRoute>
        }
      />

      {/* =====================
          FALLBACK
          ===================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}

export default App;