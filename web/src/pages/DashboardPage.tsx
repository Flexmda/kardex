import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createEmpresa, fetchEmpleados, fetchEmpresas } from "../lib/data";
import { isManager } from "../lib/roles";
import type { Empleado, Empresa } from "../lib/types";

export default function DashboardPage() {
  const { claims, profile } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [nombre, setNombre] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!claims?.role) return;
    const [nextEmpresas, nextEmpleados] = await Promise.all([
      fetchEmpresas(claims),
      fetchEmpleados(claims),
    ]);
    setEmpresas(nextEmpresas);
    setEmpleados(nextEmpleados);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [claims]);

  async function onCreateEmpresa(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await createEmpresa(nombre);
      setNombre("");
      setMessage("Empresa creada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la empresa");
    }
  }

  return (
    <>
      {message && <div className="alert">{message}</div>}
      {error && <div className="alert warn">{error}</div>}

      {profile?.role === "SUPERADMIN" && (
        <div className="card">
          <h3>Administración de empresas</h3>
          <form className="row" onSubmit={onCreateEmpresa}>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de nueva empresa"
              required
            />
            <button className="btn green" type="submit">
              Crear empresa
            </button>
          </form>
        </div>
      )}

      <div className="section-head">
        <h2>Reportes por empresa</h2>
      </div>
      <div className="cards-3">
        {empresas.map((empresa) => (
          <div className="card tight" key={empresa.id}>
            <strong>{empresa.nombre}</strong>
            <Link className="btn" to={`/empresa/${empresa.id}/reporte`}>
              Ver resumen
            </Link>
          </div>
        ))}
        {empresas.length === 0 && <p className="small">No hay empresas visibles.</p>}
      </div>

      <div className="section-head">
        <h2>Lista de empleados</h2>
        {isManager(profile?.role) && (
          <Link className="btn" to="/empleado/nuevo">
            + Nuevo empleado
          </Link>
        )}
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Nombre</th>
              <th>Cédula</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((emp) => (
              <tr key={emp.id}>
                <td>
                  <span className="badge">{emp.empresaNombre}</span>
                </td>
                <td>
                  <strong>{emp.nombre}</strong>
                </td>
                <td>{emp.cedula || "N/D"}</td>
                <td>{emp.fechaIngreso}</td>
                <td>{emp.fechaSalida || "Activo"}</td>
                <td>
                  <Link className="btn" to={`/empleado/${emp.id}`}>
                    Ver kardex
                  </Link>
                </td>
              </tr>
            ))}
            {empleados.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No hay empleados registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
