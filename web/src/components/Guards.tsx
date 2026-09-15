import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isManager } from "../lib/roles";

export function RequireAuth() {
  const { loading, user, profile } = useAuth();
  if (loading) return <p className="container">Cargando sesión…</p>;
  if (!user || !profile) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireManager() {
  const { profile } = useAuth();
  if (!isManager(profile?.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <p>Cargando…</p>;
  if (profile?.role === "EMPLEADO") {
    if (profile.empleadoId) return <Navigate to={`/empleado/${profile.empleadoId}`} replace />;
    return <p>El usuario no tiene un empleado asociado.</p>;
  }
  return <Outlet />;
}
