import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createEmpleado, fetchEmpleado, fetchEmpresas, updateEmpleado } from "../lib/data";
import type { Empleado, Empresa } from "../lib/types";

const empty: Omit<Empleado, "id" | "empresaNombre"> = {
  empresaId: "",
  nombre: "",
  cedula: "",
  cargo: "",
  fechaIngreso: "",
  fechaSalida: null,
  observaciones: "",
};

export default function EmployeeFormPage() {
  const { empleadoId } = useParams();
  const editing = Boolean(empleadoId);
  const { claims } = useAuth();
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!claims?.role) return;
    fetchEmpresas(claims).then((items) => {
      setEmpresas(items);
      setForm((prev) => ({ ...prev, empresaId: prev.empresaId || items[0]?.id || "" }));
    });
    if (empleadoId) {
      fetchEmpleado(empleadoId).then((empleado) => {
        if (!empleado) {
          setError("Empleado no encontrado");
          return;
        }
        setForm({
          empresaId: empleado.empresaId,
          nombre: empleado.nombre,
          cedula: empleado.cedula,
          cargo: empleado.cargo,
          fechaIngreso: empleado.fechaIngreso,
          fechaSalida: empleado.fechaSalida,
          observaciones: empleado.observaciones,
        });
      });
    }
  }, [claims, empleadoId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (editing && empleadoId) {
        await updateEmpleado(empleadoId, form);
        navigate(`/empleado/${empleadoId}`);
      } else {
        const id = await createEmpleado(form);
        navigate(`/empleado/${id}`);
      }
    } catch (err) {
      savingRef.current = false;
      setSaving(false);
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  return (
    <div className="card form-card">
      <h3>{editing ? "Editar datos de empleado" : "Registrar nuevo empleado"}</h3>
      {error && <div className="alert warn">{error}</div>}
      <form onSubmit={onSubmit}>
        <label>Empresa</label>
        <select
          value={form.empresaId}
          onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
          required
        >
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </option>
          ))}
        </select>
        <label>Nombre completo</label>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        <label>Cédula / identificación</label>
        <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
        <label>Cargo</label>
        <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} required />
        <label>Fecha de ingreso</label>
        <input
          type="date"
          value={form.fechaIngreso}
          onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
          required
        />
        <label>Fecha de salida (opcional)</label>
        <input
          type="date"
          value={form.fechaSalida || ""}
          onChange={(e) => setForm({ ...form, fechaSalida: e.target.value || null })}
        />
        <label>Observaciones</label>
        <textarea
          rows={2}
          value={form.observaciones}
          onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
        />
        <div className="actions">
          <button className="btn green" type="submit" disabled={saving}>
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar empleado"}
          </button>
          <Link className="btn gray" to={editing ? `/empleado/${empleadoId}` : "/"}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
