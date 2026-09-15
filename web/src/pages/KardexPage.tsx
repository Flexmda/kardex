import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deleteDescargo, fetchDescargos, fetchEmpleado } from "../lib/data";
import { buildKardex, kardexTotals } from "../lib/kardex";
import { downloadDescargoPdf } from "../lib/pdf";
import { isManager } from "../lib/roles";
import type { Empleado, KardexRow } from "../lib/types";

export default function KardexPage() {
  const { empleadoId } = useParams();
  const { profile } = useAuth();
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [rows, setRows] = useState<KardexRow[]>([]);
  const [error, setError] = useState("");
  const manage = isManager(profile?.role);
  const canGoHome = profile?.role !== "EMPLEADO";

  async function load() {
    if (!empleadoId) return;
    const next = await fetchEmpleado(empleadoId);
    if (!next) {
      setError("Empleado no encontrado o sin permisos");
      return;
    }
    const descargos = await fetchDescargos(empleadoId);
    setEmpleado(next);
    setRows(buildKardex(next, descargos));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [empleadoId]);

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este descargo?")) return;
    await deleteDescargo(id);
    await load();
  }

  if (error) return <div className="alert warn">{error}</div>;
  if (!empleado) return <p>Cargando…</p>;

  const totals = kardexTotals(rows);

  return (
    <>
      <div className="section-head">
        <div>
          <h2>Kardex vacacional</h2>
          <p className="small">
            {empleado.nombre} | Cargo: {empleado.cargo || "N/D"}
            {empleado.cedula ? ` (${empleado.cedula})` : ""} — {empleado.empresaNombre}
          </p>
        </div>
        <div className="actions">
          {canGoHome && (
            <Link className="btn gray" to="/">
              ← Volver
            </Link>
          )}
          {manage && (
            <>
              <Link className="btn" to={`/empleado/${empleado.id}/editar`}>
                Editar empleado
              </Link>
              <Link className="btn green" to={`/empleado/${empleado.id}/descargo`}>
                + Registrar descargo
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="stat-card green">
          <h6>Total ganado</h6>
          <div className="stat">{totals.totalGanado} días</div>
        </div>
        <div className="stat-card warn">
          <h6>Total tomado</h6>
          <div className="stat">{totals.totalTomado} días</div>
        </div>
        <div className="stat-card info">
          <h6>Saldo actual</h6>
          <div className="stat">{totals.saldo} días</div>
        </div>
      </div>

      <div className="card table-card">
        <div className="card-head">Detalle por períodos y descargos</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Período laboral</th>
              <th>Días ganados</th>
              <th>Días tomados</th>
              <th>Saldo acumulado</th>
              <th>Detalle descargos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.numeroPeriodo}>
                <td>{row.numeroPeriodo}</td>
                <td>{row.periodo}</td>
                <td>{row.diasGanados}</td>
                <td>{row.diasTomados}</td>
                <td>
                  <strong>{row.saldo}</strong>
                </td>
                <td>
                  {row.descargos.length === 0 ? (
                    <span className="small">Sin descargos</span>
                  ) : (
                    <ul className="descargo-list">
                      {row.descargos.map((descargo) => (
                        <li key={descargo.id}>
                          {descargo.fechaInicio} al {descargo.fechaFin} (<strong>{descargo.dias}d</strong>) — {descargo.motivo}
                          <button type="button" className="link" onClick={() => downloadDescargoPdf(empleado, descargo)}>
                            PDF
                          </button>
                          {manage && (
                            <button type="button" className="link danger" onClick={() => onDelete(descargo.id)}>
                              Eliminar
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
