import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isManager } from "../lib/roles";

export default function Layout() {
  const { profile, logout } = useAuth();
  const manage = isManager(profile?.role);

  return (
    <>
      <nav className="topnav">
        <Link to="/" className="brand">
          Kardex de Vacaciones — Ecuador
        </Link>
        <div className="nav-right">
          {manage && (
            <NavLink to="/usuarios" className="nav-link">
              Usuarios
            </NavLink>
          )}
          <span className="who">
            {profile?.displayName || profile?.email} <span className="badge">{profile?.role}</span>
          </span>
          <button type="button" className="btn gray" onClick={() => logout()}>
            Cerrar sesión
          </button>
        </div>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}
