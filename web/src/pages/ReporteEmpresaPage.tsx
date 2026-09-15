import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchDescargos, fetchEmpleadosByEmpresa, fetchEmpresas } from "../lib/data";
import { buildKardex, kardexTotals } from "../lib/kardex";
import type { Empleado, Empresa } from "../lib/types";

type Resumen = {
  empleado: Empleado;
  totalGanado: number;
  totalTomado: number;
  saldo: number;
};

export default function ReporteEmpresaPage() {
  const { empresaId } = useParams();
  const { claims } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [resumen, setResumen] = useState<Resumen[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!empresaId || !claims?.role) return;
    (async () => {
      const empresas = await fetchEmpresas(claims);
      const found = empresas.find((item) => item.id === empresaId) || null;
      if (!found) {
        setError("Empresa no encontrada o sin permisos");
        return;
      }
      setEmpresa(found);
      const empleados = await fetchEmpleadosByEmpresa(empresaId);
      const rows: Resumen[] = [];
      for (const empleado of empleados) {
        const descargos = await fetchDescargos(empleado.id);
        const totals = kardexTotals(buildKardex(empleado, descargos));
        rows.push({
          empleado,
          totalGanado: totals.totalGanado,
          totalTomado: totals.totalTomado,
          saldo: totals.saldo,
        });
      }
      setResumen(rows);
    })().catch((err) => setError(err.message));
  }, [empresaId, claims]);

  if (error) return <div className="alert warn">{error}</div>;
  if (!empresa) return <p>Cargando…</p>;

  const totalGanado = resumen.reduce((sum, item) => sum + item.totalGanado, 0);
  const totalTomado = resumen.reduce((sum, item) => sum + item.totalTomado, 0);
  const saldo = totalGanado - totalTomado;

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Resumen de kardex</h2>
          <p className="small">{empresa.nombre}</p>
        </div>
        <Link className="btn gray" to="/">
          Volver
        </Link>
      </div>
      <div className="grid">
        <div className="stat-card green">
          <h6>Total ganado</h6>
          <div className="stat">{totalGanado} días</div>
        </div>
        <div className="stat-card warn">
          <h6>Total tomado</h6>
          <div className="stat">{totalTomado} días</div>
        </div>
        <div className="stat-card info">
          <h6>Saldo total</h6>
          <div className="stat">{saldo} días</div>
        </div>
      </div>
      <div className="card table-card">
        <div className="card-head">Detalle por empleado</div>
        <table>
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Cédula</th>
              <th>Estado</th>
              <th>Días ganados</th>
              <th>Días tomados</th>
              <th>Saldo</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((item) => (
              <tr key={item.empleado.id}>
                <td>
                  <strong>{item.empleado.nombre}</strong>
                </td>
                <td>{item.empleado.cedula || "N/D"}</td>
                <td>{item.empleado.fechaSalida ? "Retirado" : "Activo"}</td>
                <td>{item.totalGanado}</td>
                <td>{item.totalTomado}</td>
                <td>
                  <strong>{item.saldo}</strong>
                </td>
                <td>
                  <Link className="btn" to={`/empleado/${item.empleado.id}`}>
                    Ver kardex
                  </Link>
                </td>
              </tr>
            ))}
            {resumen.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No hay empleados registrados en esta empresa.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>Totales de {empresa.nombre}</th>
              <th>{totalGanado}</th>
              <th>{totalTomado}</th>
              <th>{saldo}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
