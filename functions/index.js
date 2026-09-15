const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ region: "us-central1" });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ALLOWED_ROLES = new Set(["SUPERADMIN", "ADMIN", "EMPLEADO"]);

function requireManage(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Debe iniciar sesión.");
  }
  const role = auth.token.role;
  if (role !== "SUPERADMIN" && role !== "ADMIN") {
    throw new HttpsError("permission-denied", "No autorizado para crear usuarios.");
  }
  return auth.token;
}

exports.provisionUser = onCall(async (request) => {
  const caller = requireManage(request.auth);
  const data = request.data || {};
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");
  const displayName = String(data.displayName || "").trim();
  const role = String(data.role || "").trim().toUpperCase();
  let empresaId = data.empresaId ? String(data.empresaId) : null;
  let empleadoId = data.empleadoId ? String(data.empleadoId) : null;

  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "Email inválido.");
  }
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "La contraseña debe tener al menos 6 caracteres.");
  }
  if (!displayName) {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio.");
  }
  if (!ALLOWED_ROLES.has(role)) {
    throw new HttpsError("invalid-argument", "Rol no permitido.");
  }
  if (caller.role === "ADMIN") {
    if (role === "SUPERADMIN") {
      throw new HttpsError("permission-denied", "Un ADMIN no puede crear SUPERADMIN.");
    }
    empresaId = String(caller.empresaId || "");
    if (!empresaId) {
      throw new HttpsError("failed-precondition", "El ADMIN no tiene empresa asignada.");
    }
  }
  if (role === "ADMIN" && !empresaId) {
    throw new HttpsError("invalid-argument", "ADMIN requiere empresaId.");
  }
  if (role === "EMPLEADO") {
    if (!empresaId || !empleadoId) {
      throw new HttpsError("invalid-argument", "EMPLEADO requiere empresaId y empleadoId.");
    }
  }
  if (role === "SUPERADMIN") {
    empresaId = null;
    empleadoId = null;
  }
  if (role === "ADMIN") {
    empleadoId = null;
  }

  if (empleadoId) {
    const emp = await db.collection("empleados").doc(empleadoId).get();
    if (!emp.exists) {
      throw new HttpsError("not-found", "El empleado no existe.");
    }
    const empEmpresa = String(emp.data().empresaId || "");
    if (empEmpresa !== String(empresaId)) {
      throw new HttpsError("invalid-argument", "El empleado no pertenece a esa empresa.");
    }
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Ese email ya está registrado.");
    }
    throw new HttpsError("internal", error.message || "No se pudo crear el usuario.");
  }

  const claims = { role };
  if (empresaId) claims.empresaId = empresaId;
  if (empleadoId) claims.empleadoId = empleadoId;
  await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  await db.collection("users").doc(userRecord.uid).set({
    email,
    displayName,
    role,
    empresaId,
    empleadoId,
  });

  return { uid: userRecord.uid };
});
