import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, profile, login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!loading && user && profile) {
    if (profile.role === "EMPLEADO" && profile.empleadoId) {
      return <Navigate to={`/empleado/${profile.empleadoId}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch {
      setError("Usuario o contraseña incorrectos.");
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h2>Iniciar sesión</h2>
        {error && <div className="alert warn">{error}</div>}
        <form onSubmit={onSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn" type="submit" disabled={loading}>
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
