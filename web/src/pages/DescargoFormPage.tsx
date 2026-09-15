import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { calendarDaysInclusive, buildKardex, formatIsoDate } from "../lib/kardex";
import { createDescargo, fetchDescargos, fetchEmpleado } from "../lib/data";
import type { Empleado, KardexRow } from "../lib/types";

export default function DescargoFormPage() {
  const { empleadoId } = useParams();
  const navigate = useNavigate();
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [rows, setRows] = useState<KardexRow[]>([]);
  const [fechaDescargo, setFechaDescargo] = useState(formatIsoDate(new Date()));
  const [periodo, setPeriodo] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [responsable, setResponsable] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!empleadoId) return;
    (async () => {
      const next = await fetchEmpleado(empleadoId);
      if (!next) {
        setError("Empleado no encontrado o sin permisos");
        return;
      }
      const descargos = await fetchDescargos(empleadoId);
      const kardex = buildKardex(next, descargos);
      setEmpleado(next);
      setRows(kardex);
      setPeriodo(kardex[0]?.periodo || "");
    })().catch((err) => setError(err.message));
  }, [empleadoId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!empleado || !empleadoId) return;
    const dias = calendarDaysInclusive(fechaInicio, fechaFin);
    if (dias < 1) {
      setError("La fecha fin debe ser igual o posterior a la fecha inicio.");
      return;
    }
    try {
      await createDescargo({
        empleadoId,
        empresaId: empleado.empresaId,
        fechaDescargo,
        periodo,
        fechaInicio,
        fechaFin,
        dias,
        motivo,
        responsable,
      });
      navigate(`/empleado/${empleadoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el descargo");
    }
  }

  if (!empleado) return error ? <div className="alert warn">{error}</div> : <p>Cargando…</p>;

  return (
    <div className="card form-card">
      <h3>Registrar descargo de vacaciones</h3>
      <p className="small">Empleado: {empleado.nombre}</p>
      {error && <div className="alert warn">{error}</div>}
      <form onSubmit={onSubmit}>
        <label>Fecha de registro</label>
        <input type="date" value={fechaDescargo} onChange={(e) => setFechaDescargo(e.target.value)} required />
        <label>Período al que corresponde descontar</label>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} required>
          {rows.map((row) => (
            <option key={row.numeroPeriodo} value={row.periodo}>
              Período {row.numeroPeriodo} ({row.periodo})
            </option>
          ))}
        </select>
        <div className="two-col">
          <div>
            <label>Fecha inicio</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
          </div>
          <div>
            <label>Fecha fin</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
          </div>
        </div>
        <label>Motivo / observaciones</label>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <label>Responsable / autoriza</label>
        <input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
        <div className="actions">
          <button className="btn" type="submit">
            Registrar descargo
          </button>
          <Link className="btn gray" to={`/empleado/${empleadoId}`}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
