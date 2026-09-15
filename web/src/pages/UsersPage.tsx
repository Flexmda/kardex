import { httpsCallable } from "firebase/functions";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchEmpleados, fetchEmpresas, fetchUsers } from "../lib/data";
import { functions } from "../lib/firebase";
import type { Empleado, Empresa, Role, UserProfile } from "../lib/types";

export default function UsersPage() {
  const { claims, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>(profile?.role === "SUPERADMIN" ? "ADMIN" : "EMPLEADO");
  const [empresaId, setEmpresaId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!claims?.role) return;
    const [nextUsers, nextEmpresas, nextEmpleados] = await Promise.all([
      fetchUsers(claims),
      fetchEmpresas(claims),
      fetchEmpleados(claims),
    ]);
    setUsers(nextUsers);
    setEmpresas(nextEmpresas);
    setEmpleados(nextEmpleados);
    setEmpresaId((prev) => prev || claims.empresaId || nextEmpresas[0]?.id || "");
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [claims]);

  const empleadosFiltrados = empleados.filter((item) => item.empresaId === empresaId);
  const empresaNombre = (id: string | null) =>
    id ? empresas.find((empresa) => empresa.id === id)?.nombre || id : "—";
  const empleadoNombre = (id: string | null) =>
    id ? empleados.find((empleado) => empleado.id === id)?.nombre || id : "—";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const provisionUser = httpsCallable(functions, "provisionUser");
      await provisionUser({
        email,
        password,
        displayName,
        role,
        empresaId: role === "SUPERADMIN" ? null : empresaId,
        empleadoId: role === "EMPLEADO" ? empleadoId : null,
      });
      setEmail("");
      setPassword("");
      setDisplayName("");
      setMessage("Usuario creado. Debe iniciar sesión con el email y la contraseña asignados.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario");
    }
  }

  return (
    <>
      <div className="section-head">
        <h2>Usuarios</h2>
      </div>
      {message && <div className="alert">{message}</div>}
      {error && <div className="alert warn">{error}</div>}
      <div className="card form-card">
        <h3>Alta de usuario</h3>
        <form onSubmit={onSubmit}>
          <label>Nombre</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Contraseña temporal</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          <label>Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {profile?.role === "SUPERADMIN" && <option value="SUPERADMIN">SUPERADMIN</option>}
            <option value="ADMIN">ADMIN</option>
            <option value="EMPLEADO">EMPLEADO</option>
          </select>
          {role !== "SUPERADMIN" && (
            <>
              <label>Empresa</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </>
          )}
          {role === "EMPLEADO" && (
            <>
              <label>Empleado vinculado</label>
              <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} required>
                <option value="">Seleccione…</option>
                {empleadosFiltrados.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre}
                  </option>
                ))}
              </select>
            </>
          )}
          <button className="btn" type="submit">
            Crear usuario
          </button>
        </form>
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Empresa</th>
              <th>Empleado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.displayName}</td>
                <td>{item.email}</td>
                <td>
                  <span className="badge">{item.role}</span>
                </td>
                <td>{empresaNombre(item.empresaId)}</td>
                <td>{empleadoNombre(item.empleadoId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
