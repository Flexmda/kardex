#!/usr/bin/env python3
"""Copia empresas, empleados y descargos de SQLite a Firestore (camelCase)."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3

import firebase_admin
from firebase_admin import auth, credentials, firestore


PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "kardex-de-vacaciones")
SQLITE_DB = os.getenv("SQLITE_DB", "vacaciones_multicompany.db")


def firebase_db():
    if not firebase_admin._apps:
        options = {"projectId": PROJECT_ID}
        service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT")
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        emulator = os.getenv("FIRESTORE_EMULATOR_HOST") or os.getenv("FIREBASE_AUTH_EMULATOR_HOST")
        if service_account:
            cred = credentials.Certificate(json.loads(service_account))
            firebase_admin.initialize_app(cred, options)
        elif cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, options)
        elif emulator:
            from google.auth.credentials import AnonymousCredentials

            class EmulatorCredentials(credentials.Base):
                def __init__(self):
                    super().__init__()
                    self._g_credential = AnonymousCredentials()

                def get_credential(self):
                    return self._g_credential

            firebase_admin.initialize_app(EmulatorCredentials(), options)
        else:
            firebase_admin.initialize_app(options=options)
    return firestore.client()


def migrate_empresas(db, sqlite):
    rows = sqlite.execute("SELECT * FROM empresas").fetchall()
    for row in rows:
        values = dict(row)
        document_id = str(values.pop("id"))
        db.collection("empresas").document(document_id).set({
            "nombre": values.get("nombre") or "",
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
    print(f"empresas: {len(rows)} registros")


def migrate_empleados(db, sqlite):
    rows = sqlite.execute("SELECT * FROM empleados").fetchall()
    for row in rows:
        values = dict(row)
        document_id = str(values.pop("id"))
        db.collection("empleados").document(document_id).set({
            "empresaId": str(values.get("empresa_id") or ""),
            "nombre": values.get("nombre") or "",
            "cedula": values.get("cedula") or "",
            "cargo": values.get("cargo") or "",
            "fechaIngreso": values.get("fecha_ingreso") or "",
            "fechaSalida": values.get("fecha_salida") or None,
            "observaciones": values.get("observaciones") or "",
        })
    print(f"empleados: {len(rows)} registros")
    return {str(dict(row)["id"]): str(dict(row).get("empresa_id") or "") for row in rows}


def migrate_descargos(db, sqlite, empleado_empresa):
    rows = sqlite.execute("SELECT * FROM descargos").fetchall()
    for row in rows:
        values = dict(row)
        document_id = str(values.pop("id"))
        empleado_id = str(values.get("empleado_id") or "")
        db.collection("descargos").document(document_id).set({
            "empleadoId": empleado_id,
            "empresaId": empleado_empresa.get(empleado_id, ""),
            "fechaDescargo": values.get("fecha_descargo") or "",
            "periodo": values.get("periodo") or "",
            "fechaInicio": values.get("fecha_inicio") or "",
            "fechaFin": values.get("fecha_fin") or "",
            "dias": int(values.get("dias") or 0),
            "motivo": values.get("motivo") or "",
            "responsable": values.get("responsable") or "",
        })
    print(f"descargos: {len(rows)} registros")


def migrate_users(db, sqlite, domain: str, password: str):
    rows = sqlite.execute("SELECT * FROM usuarios").fetchall()
    created = 0
    for row in rows:
        values = dict(row)
        username = (values.get("username") or "").strip()
        if not username:
            continue
        email = f"{username.lower()}@{domain}"
        role = (values.get("rol") or "EMPLEADO").upper()
        if role not in {"SUPERADMIN", "ADMIN", "EMPLEADO"}:
            role = "EMPLEADO"
        empresa_id = str(values["empresa_id"]) if values.get("empresa_id") not in (None, "") else None
        empleado_id = str(values["empleado_id"]) if values.get("empleado_id") not in (None, "") else None
        if role == "SUPERADMIN":
            empresa_id = None
            empleado_id = None
        if role == "ADMIN":
            empleado_id = None
        display_name = username
        try:
            user = auth.get_user_by_email(email)
        except auth.UserNotFoundError:
            user = auth.create_user(email=email, password=password, display_name=display_name)
            created += 1
        claims = {"role": role}
        if empresa_id:
            claims["empresaId"] = empresa_id
        if empleado_id:
            claims["empleadoId"] = empleado_id
        auth.set_custom_user_claims(user.uid, claims)
        db.collection("users").document(user.uid).set({
            "email": email,
            "displayName": display_name,
            "role": role,
            "empresaId": empresa_id,
            "empleadoId": empleado_id,
        })
        print(f"usuario {username} -> {email} ({role})")
    print(f"usuarios Auth: {len(rows)} procesados, {created} creados. Contraseña temporal: {password}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=SQLITE_DB)
    parser.add_argument("--skip-data", action="store_true")
    parser.add_argument("--users", action="store_true", help="Crea cuentas Auth a partir de usuarios SQLite")
    parser.add_argument("--domain", default="migrated.kardex.local")
    parser.add_argument("--temp-password", default="Cambiar123")
    args = parser.parse_args()

    if not os.path.exists(args.db):
        raise FileNotFoundError(f"No existe {args.db}")

    sqlite = sqlite3.connect(args.db)
    sqlite.row_factory = sqlite3.Row
    db = firebase_db()
    try:
        if not args.skip_data:
            migrate_empresas(db, sqlite)
            empleado_empresa = migrate_empleados(db, sqlite)
            migrate_descargos(db, sqlite, empleado_empresa)
        if args.users:
            migrate_users(db, sqlite, args.domain, args.temp_password)
    finally:
        sqlite.close()
    print("Migración terminada. Los documentos conservan los IDs de SQLite.")


if __name__ == "__main__":
    main()
