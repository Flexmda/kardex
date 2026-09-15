import os
import sqlite3

import firebase_admin
from firebase_admin import credentials, firestore


PROJECT_ID = "kardex-de-vacaciones"
SQLITE_DB = "vacaciones_multicompany.db"
COLLECTIONS = ("empresas", "usuarios", "empleados", "descargos")


def firebase_db():
    if not firebase_admin._apps:
        service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT")
        if service_account:
            import json
            cred = credentials.Certificate(json.loads(service_account))
        else:
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
    return firestore.client()


def migrate_collection(db, sqlite, collection_name):
    rows = sqlite.execute(f"SELECT * FROM {collection_name}").fetchall()
    for row in rows:
        values = dict(row)
        document_id = str(values.pop("id"))
        for key in ("empresa_id", "empleado_id"):
            if key in values and values[key] is not None:
                values[key] = str(values[key])
        db.collection(collection_name).document(document_id).set(values)
    print(f"{collection_name}: {len(rows)} registros migrados")


def main():
    if not os.path.exists(SQLITE_DB):
        raise FileNotFoundError(f"No existe {SQLITE_DB}")

    sqlite = sqlite3.connect(SQLITE_DB)
    sqlite.row_factory = sqlite3.Row
    db = firebase_db()
    try:
        for collection_name in COLLECTIONS:
            migrate_collection(db, sqlite, collection_name)
    finally:
        sqlite.close()
    print("Migracion terminada. Los documentos conservan los IDs de SQLite.")


if __name__ == "__main__":
    main()
