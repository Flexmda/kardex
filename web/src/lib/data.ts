import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, addDoc, setDoc, updateDoc, deleteDoc, where, type DocumentData } from "firebase/firestore";
import { db } from "./firebase";
import type { AuthClaims, Descargo, Empleado, Empresa, UserProfile } from "./types";

function asString(value: unknown, fallback = "") {
  return value == null ? fallback : String(value);
}

export async function fetchEmpresas(claims: AuthClaims): Promise<Empresa[]> {
  if (claims.role === "SUPERADMIN") {
    const snap = await getDocs(query(collection(db, "empresas"), orderBy("nombre")));
    return snap.docs.map((item) => ({ id: item.id, nombre: asString(item.data().nombre) }));
  }
  if (!claims.empresaId) return [];
  const empresa = await getDoc(doc(db, "empresas", claims.empresaId));
  if (!empresa.exists()) return [];
  return [{ id: empresa.id, nombre: asString(empresa.data().nombre) }];
}

export async function createEmpresa(nombre: string) {
  await addDoc(collection(db, "empresas"), {
    nombre: nombre.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function fetchEmpleados(claims: AuthClaims): Promise<Empleado[]> {
  if (claims.role === "EMPLEADO") {
    if (!claims.empleadoId) return [];
    const empleado = await fetchEmpleado(claims.empleadoId);
    return empleado ? [empleado] : [];
  }
  if (claims.role === "ADMIN") {
    if (!claims.empresaId) return [];
    const snap = await getDocs(
      query(collection(db, "empleados"), where("empresaId", "==", claims.empresaId), orderBy("nombre")),
    );
    return Promise.all(snap.docs.map((item) => hydrateEmpleado(item.id, item.data())));
  }
  const snap = await getDocs(query(collection(db, "empleados"), orderBy("nombre")));
  return Promise.all(snap.docs.map((item) => hydrateEmpleado(item.id, item.data())));
}

export async function fetchEmpleadosByEmpresa(empresaId: string): Promise<Empleado[]> {
  const snap = await getDocs(
    query(collection(db, "empleados"), where("empresaId", "==", empresaId), orderBy("nombre")),
  );
  return Promise.all(snap.docs.map((item) => hydrateEmpleado(item.id, item.data())));
}

export async function fetchEmpleado(id: string): Promise<Empleado | null> {
  const snap = await getDoc(doc(db, "empleados", id));
  if (!snap.exists()) return null;
  return hydrateEmpleado(snap.id, snap.data());
}

async function hydrateEmpleado(id: string, data: DocumentData): Promise<Empleado> {
  const empresaId = asString(data.empresaId);
  let empresaNombre = "";
  if (empresaId) {
    const empresa = await getDoc(doc(db, "empresas", empresaId));
    empresaNombre = empresa.exists() ? asString(empresa.data().nombre) : "";
  }
  return {
    id,
    empresaId,
    nombre: asString(data.nombre),
    cedula: asString(data.cedula),
    cargo: asString(data.cargo),
    fechaIngreso: asString(data.fechaIngreso),
    fechaSalida: data.fechaSalida ? asString(data.fechaSalida) : null,
    observaciones: asString(data.observaciones),
    empresaNombre,
  };
}

export type EmpleadoInput = Omit<Empleado, "id" | "empresaNombre">;

export async function createEmpleado(input: EmpleadoInput) {
  const ref = doc(collection(db, "empleados"));
  await setDoc(ref, payloadEmpleado(input));
  return ref.id;
}

export async function updateEmpleado(id: string, input: EmpleadoInput) {
  await updateDoc(doc(db, "empleados", id), payloadEmpleado(input));
}

function payloadEmpleado(input: EmpleadoInput) {
  return {
    empresaId: input.empresaId,
    nombre: input.nombre.trim(),
    cedula: input.cedula.trim(),
    cargo: input.cargo.trim(),
    fechaIngreso: input.fechaIngreso,
    fechaSalida: input.fechaSalida || null,
    observaciones: input.observaciones.trim(),
  };
}

export async function fetchDescargos(empleadoId: string): Promise<Descargo[]> {
  const snap = await getDocs(
    query(collection(db, "descargos"), where("empleadoId", "==", empleadoId), orderBy("fechaDescargo")),
  );
  return snap.docs.map((item) => ({ id: item.id, ...normalizeDescargo(item.data()) }));
}

function normalizeDescargo(data: DocumentData): Omit<Descargo, "id"> {
  return {
    empleadoId: asString(data.empleadoId),
    empresaId: asString(data.empresaId),
    fechaDescargo: asString(data.fechaDescargo),
    periodo: asString(data.periodo),
    fechaInicio: asString(data.fechaInicio),
    fechaFin: asString(data.fechaFin),
    dias: Number(data.dias || 0),
    motivo: asString(data.motivo),
    responsable: asString(data.responsable),
  };
}

export async function createDescargo(input: Omit<Descargo, "id">) {
  await addDoc(collection(db, "descargos"), input);
}

export async function deleteDescargo(id: string) {
  await deleteDoc(doc(db, "descargos", id));
}

export async function fetchUsers(claims: AuthClaims): Promise<UserProfile[]> {
  if (claims.role === "SUPERADMIN") {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((item) => mapUser(item.id, item.data()));
  }
  if (claims.role === "ADMIN" && claims.empresaId) {
    const snap = await getDocs(query(collection(db, "users"), where("empresaId", "==", claims.empresaId)));
    return snap.docs.map((item) => mapUser(item.id, item.data()));
  }
  return [];
}

function mapUser(id: string, data: DocumentData): UserProfile {
  return {
    id,
    email: asString(data.email),
    displayName: asString(data.displayName),
    role: asString(data.role) as UserProfile["role"],
    empresaId: data.empresaId ? asString(data.empresaId) : null,
    empleadoId: data.empleadoId ? asString(data.empleadoId) : null,
  };
}
