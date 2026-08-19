import { Routes, Route } from "react-router";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UserAccountsPage from "./pages/UserAccountsPage";
import UserDetailsPage from "./pages/UserDetailsPage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UserAccountsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users/:userId"
        element={
          <ProtectedRoute>
            <UserDetailsPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;