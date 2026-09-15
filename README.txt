# Kardex de Vacaciones Web

## Requisitos
Python 3.10 o superior.

## Instalación
1. Abra una consola dentro de esta carpeta.
2. Ejecute:
   .venv\Scripts\python.exe -m pip install -r requirements.txt
3. Para revisar la aplicación localmente con SQLite, ejecute:
   (PowerShell) `$env:LOCAL_MODE="1"; .venv\Scripts\python.exe app.py`
   Luego abra `http://127.0.0.1:5000`.
4. En Firebase Console, abra el proyecto `kardex-de-vacaciones`, active Firestore y cree una cuenta de servicio en:
   Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada.
5. Guarde el JSON fuera del repositorio y defina la variable de entorno:
   `set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\firebase-service-account.json`
   (PowerShell: `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\a\firebase-service-account.json"`).
6. Para copiar los datos existentes de SQLite a Firestore, ejecute una sola vez:
   `python migrar_a_firebase.py`
7. Ejecute:
   python app.py
8. Abra en el navegador:
   http://127.0.0.1:5000

También puede hacer doble clic en `iniciar.bat`.

## Seguridad y configuración
- El backend Flask usa Firebase Admin SDK y Firestore. El objeto `firebaseConfig` del SDK web no reemplaza la cuenta de servicio del servidor.
- No publique ni suba al repositorio el JSON de la cuenta de servicio. La clave API web puede ser pública, pero las reglas de Firestore y las credenciales del servidor deben protegerse.
- La primera ejecución crea en Firestore el usuario `admin` con clave inicial `admin123`. Cámbiela antes de usar el sistema en producción.

## Funcionamiento
- Registrar empleado.
- El sistema genera los períodos desde la fecha de ingreso.
- Registrar cada descargo con fecha inicial y final.
- El sistema calcula días tomados y saldo.
- Registrar fecha de salida para visualizar el saldo final.

## Perfiles y permisos
- `ADMIN`: administra empleados, descargos y salidas únicamente de su `empresa_id`.
- `EMPLEADO`: solo puede consultar el kardex y los descargos del empleado indicado en su `empleado_id`; no puede acceder al panel general ni modificar datos.
- `SUPERADMIN` se conserva para compatibilidad con el usuario inicial y tiene acceso global.

La tabla `usuarios` se actualiza automáticamente en SQLite con la columna `empleado_id`. Para vincular un usuario empleado existente, use el ID correspondiente de `empleados`:

```sql
UPDATE usuarios SET rol = 'EMPLEADO', empleado_id = 3, empresa_id = 1
WHERE username = 'usuario_empleado';
```

Para un administrador de empresa:

```sql
UPDATE usuarios SET rol = 'ADMIN', empleado_id = NULL, empresa_id = 1
WHERE username = 'admin_empresa';
```

La escala de días se basa en la guía proporcionada:
1-5: 15; 6:16; 7:17; 8:18; 9:19; 10-15:20; 16-20:25; 21+:30.

Nota: esta primera versión calcula los días del descargo como días calendario. La regla exacta que deba aplicarse al conteo de vacaciones de su empresa puede adaptarse antes de ponerlo en producción.
