import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(path.join(fileURLToPath(new URL(".", import.meta.url)), "../functions/package.json"));
const admin = require("firebase-admin");

const email = process.env.BOOTSTRAP_EMAIL || "admin@kardex.local";
const password = process.env.BOOTSTRAP_PASSWORD || "admin123456";
const displayName = process.env.BOOTSTRAP_NAME || "Superadmin";
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "kardex-de-vacaciones";

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

async function main() {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    console.log("El usuario ya existe:", user.uid);
  } catch {
    user = await admin.auth().createUser({ email, password, displayName });
    console.log("Usuario creado:", user.uid);
  }
  await admin.auth().setCustomUserClaims(user.uid, { role: "SUPERADMIN" });
  await db.collection("users").doc(user.uid).set({
    email,
    displayName,
    role: "SUPERADMIN",
    empresaId: null,
    empleadoId: null,
  });
  console.log(`SUPERADMIN listo: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
