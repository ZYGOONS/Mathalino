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
import TeacherActivitiesPage from "./pages/TeacherActivitiesPage";
import TeacherGuardianRequestsPage from "./pages/TeacherGuardianRequestsPage";
import TeacherAccountPage from "./pages/TeacherAccountPage";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={<LoginPage />}
      />

      {/* ADMIN */}

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

      {/* TEACHER */}

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
        path="/teacher/guardian-requests"
        element={
          <ProtectedRoute
            allowedRole="teacher"
          >
            <TeacherGuardianRequestsPage />
          </ProtectedRoute>
        }
      />

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