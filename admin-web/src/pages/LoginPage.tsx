import { useNavigate } from "react-router";
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = () => {
  localStorage.setItem("mathalinoAdminLoggedIn", "true");
  navigate("/dashboard");
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <h1>Mathalino</h1>
          <p>Smart Mathematics Learning Platform</p>
        </div>

        <div className="login-title">
          <h2>Administrator Login</h2>
          <p>Sign in to access the administration portal.</p>
        </div>

        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            placeholder="Enter administrator email"
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter password"
          />
        </div>

        <button
          className="login-button"
          onClick={handleLogin}
        >
          Log In
        </button>

        <p className="admin-note">
          Authorized administrators only
        </p>

      </div>
    </div>
  );
}

export default LoginPage;