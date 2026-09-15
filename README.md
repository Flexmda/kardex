# Kardex de Vacaciones (React + Firebase)

SPA en Vite/React con Firebase Authentication, Cloud Firestore y una Cloud Function para el alta de usuarios. El cálculo de kardex (períodos por aniversario y escala de días) vive en el cliente.

Sitio desplegado: https://kardex-de-vacaciones.web.app

## Requisitos

- Node.js 20+
- Cuenta de Firebase y el proyecto `kardex-de-vacaciones` (o el ID que configure en `.firebaserc`)

## Configuración local

La app apunta a **Firebase de producción** (Auth + Firestore reales). El emulador es opcional: `VITE_USE_EMULATORS=true` en `web/.env`.

1. Instale dependencias:

```bash
npm install
npm --prefix web install
npm --prefix functions install
```

2. Cree el primer SUPERADMIN contra el proyecto real (sin variables de emulador):

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/ruta/a/firebase-service-account.json"
export GCLOUD_PROJECT=kardex-de-vacaciones
node scripts/bootstrap-superadmin.mjs
```

3. Arranque Vite (`npm --prefix web run dev`) o use el sitio desplegado. Active **Email/Password** en [Authentication](https://console.firebase.google.com/project/kardex-de-vacaciones/authentication/providers) si el login falla.

Para emuladores: `VITE_USE_EMULATORS=true`, `npm run emulators` y el bootstrap con `FIREBASE_AUTH_EMULATOR_HOST` / `FIRESTORE_EMULATOR_HOST`.

## Pruebas del motor de kardex

```bash
npm --prefix web test
```

## Roles

- `SUPERADMIN`: empresas, empleados, descargos y usuarios de todas las empresas.
- `ADMIN`: empleados, descargos y usuarios de su `empresaId`.
- `EMPLEADO`: solo consulta su kardex y PDF.

Los roles van en custom claims. El documento `users/{uid}` es un espejo para la UI; el cliente no puede escribir esa colección.

## Migración desde SQLite

El script usa el Admin SDK (Application Default Credentials o `FIREBASE_SERVICE_ACCOUNT` JSON). No copie claves al repositorio.

```bash
python3 -m pip install firebase-admin
python3 migrar_a_firebase.py
python3 migrar_a_firebase.py --skip-data --users --domain su-empresa.com --temp-password 'Cambiar123'
```

Las contraseñas hash de Flask no se reutilizan. Cada usuario migrado queda con email `{username}@{dominio}` y la clave temporal indicada.

Si el archivo `serviceAccountKey.json.json` llegó a subirse o compartirse, revoque esa clave en Google Cloud y genere otra.

## Producción

Cloud Functions (`provisionUser`) requiere el plan Blaze de Firebase. Hasta activarlo, cree usuarios con `scripts/bootstrap-superadmin.mjs` o `migrar_a_firebase.py --users`.

1. Active Email/Password en Authentication y despliegue reglas + hosting:

```bash
npm --prefix web run build
npx firebase deploy --only firestore,hosting --project kardex-de-vacaciones
```

Cuando el proyecto esté en Blaze:

```bash
npx firebase deploy --only functions --project kardex-de-vacaciones
```

2. Cree el primer SUPERADMIN con el script de bootstrap (sin variables de emulador) o desde Firebase Console + claims.
3. He configurado reglas de Firestore de prototipo para que los datos no queden abiertos: autenticación obligatoria, roles por claims, denegación por defecto y validación de campos. Revíselas antes de compartir el sistema de forma amplia.

## Seguridad

- No suba JSON de cuentas de servicio.
- La API key web puede ser pública; las reglas y las Functions son la protección real.
- Flask, Render y SQLite como backend de la app quedaron fuera de este stack.
