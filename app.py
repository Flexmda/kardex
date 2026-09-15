from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response
import os
import sqlite3
from datetime import date, datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import io

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "cambia-esta-clave-secreta-multiempresa-v2")

LOCAL_DB = os.path.join(os.path.dirname(__file__), "vacaciones_multicompany.db")


class LocalDocument:
    def __init__(self, document_id, data):
        self.id = str(document_id)
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class LocalQuery:
    def __init__(self, db, collection_name, filters=(), order_field=None, limit_value=None):
        self.db = db
        self.collection_name = collection_name
        self.filters = filters
        self.order_field = order_field
        self.limit_value = limit_value

    def where(self, field, operator, value):
        if operator != "==":
            raise ValueError("El modo local solo admite filtros de igualdad")
        return LocalQuery(self.db, self.collection_name, (*self.filters, (field, value)), self.order_field, self.limit_value)

    def order_by(self, field):
        return LocalQuery(self.db, self.collection_name, self.filters, field, self.limit_value)

    def limit(self, value):
        return LocalQuery(self.db, self.collection_name, self.filters, self.order_field, value)

    def stream(self):
        cursor = self.db.execute(f"SELECT * FROM {self.collection_name}")
        rows = cursor.fetchall()
        columns = [column[0] for column in cursor.description]
        data = [dict(zip(columns, row)) for row in rows]
        for field, value in self.filters:
            data = [item for item in data if item.get(field) == value]
        if self.order_field:
            data.sort(key=lambda item: (item.get(self.order_field) is None, item.get(self.order_field)))
        if self.limit_value is not None:
            data = data[:self.limit_value]
        return [LocalDocument(item.pop("id"), item) for item in data]


class LocalCollection(LocalQuery):
    def document(self, document_id):
        return LocalDocumentReference(self.db, self.collection_name, document_id)

    def add(self, data):
        fields = list(data)
        values = [data[field] for field in fields]
        placeholders = ", ".join("?" for _ in fields)
        cursor = self.db.execute(
            f"INSERT INTO {self.collection_name} ({', '.join(fields)}) VALUES ({placeholders})", values
        )
        self.db.commit()
        return LocalDocumentReference(self.db, self.collection_name, cursor.lastrowid), None


class LocalDocumentReference:
    def __init__(self, db, collection_name, document_id):
        self.db = db
        self.collection_name = collection_name
        self.document_id = str(document_id)

    def get(self):
        cursor = self.db.execute(
            f"SELECT * FROM {self.collection_name} WHERE id = ?", (self.document_id,)
        )
        row = cursor.fetchone()
        if row is None:
            return LocalDocument(self.document_id, None)
        columns = [column[0] for column in cursor.description]
        data = dict(zip(columns, row))
        data.pop("id", None)
        return LocalDocument(self.document_id, data)

    def set(self, data):
        fields = ["id", *data]
        values = [self.document_id, *[data[field] for field in data]]
        placeholders = ", ".join("?" for _ in fields)
        self.db.execute(
            f"INSERT OR REPLACE INTO {self.collection_name} ({', '.join(fields)}) VALUES ({placeholders})", values
        )
        self.db.commit()

    def update(self, data):
        assignments = ", ".join(f"{field} = ?" for field in data)
        self.db.execute(
            f"UPDATE {self.collection_name} SET {assignments} WHERE id = ?",
            [*data.values(), self.document_id]
        )
        self.db.commit()

    def delete(self):
        self.db.execute(f"DELETE FROM {self.collection_name} WHERE id = ?", (self.document_id,))
        self.db.commit()


class LocalDatabase:
    def __init__(self, path):
        self.connection = sqlite3.connect(path, check_same_thread=False)
        self._init_tables()

    def _init_tables(self):
        self.connection.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id TEXT PRIMARY KEY,
                username TEXT,
                password TEXT,
                rol TEXT,
                empresa_id TEXT,
                empleado_id INTEGER
            )
        """)
        self.connection.execute("""
            CREATE TABLE IF NOT EXISTS empresas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT
            )
        """)
        self.connection.execute("""
            CREATE TABLE IF NOT EXISTS empleados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id TEXT,
                nombre TEXT,
                cedula TEXT,
                cargo TEXT,
                fecha_ingreso TEXT,
                fecha_salida TEXT,
                observaciones TEXT
            )
        """)
        self.connection.execute("""
            CREATE TABLE IF NOT EXISTS descargos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empleado_id TEXT,
                fecha_descargo TEXT,
                periodo TEXT,
                fecha_inicio TEXT,
                fecha_fin TEXT,
                dias INTEGER,
                motivo TEXT,
                responsable TEXT
            )
        """)
        self.connection.commit()

        columns = {row[1] for row in self.connection.execute("PRAGMA table_info(usuarios)")}
        if "empleado_id" not in columns:
            self.connection.execute("ALTER TABLE usuarios ADD COLUMN empleado_id INTEGER")
            self.connection.commit()

    def collection(self, collection_name):
        return LocalCollection(self.connection, collection_name)


def get_db():
    # Forzar siempre SQLite de manera local/en nube
    if not hasattr(get_db, "local_db"):
        get_db.local_db = LocalDatabase(LOCAL_DB)
    return get_db.local_db


def as_row(document):
    data = document.to_dict()
    data["id"] = document.id
    return data


def collection_rows(db, collection_name, order_field=None):
    query = db.collection(collection_name)
    if order_field:
        try:
            query = query.order_by(order_field)
        except Exception:
            pass
    return [as_row(document) for document in query.stream()]


def init_db():
    try:
        db = get_db()
        admin_check = list(db.collection("usuarios").where("username", "==", "admin").limit(1).stream())
        if not admin_check:
            hashed_pw = generate_password_hash("admin123")
            db.collection("usuarios").document("admin").set({
                "username": "admin", "password": hashed_pw,
                "rol": "SUPERADMIN", "empresa_id": None, "empleado_id": None
            })
    except Exception as e:
        print(f"Aviso en init_db: {e}")


def current_user():
    if "user_id" not in session:
        return None
    document = get_db().collection("usuarios").document(str(session["user_id"])).get()
    return as_row(document) if document.exists else None


def user_has_access_to_empresa(empresa_id):
    user = current_user()
    if not user:
        return False
    if user["rol"] == "SUPERADMIN":
        return True
    return str(user["empresa_id"]) == str(empresa_id)


def user_can_manage(user):
    return user and user["rol"] in ("ADMIN", "SUPERADMIN")


def user_can_view_employee(user, empleado):
    if not user or not empleado:
        return False
    if user["rol"] == "EMPLEADO":
        return str(user.get("empleado_id")) == str(empleado["id"])
    return user_has_access_to_empresa(empleado["empresa_id"])


def annual_days(years):
    if years < 5:
        return 15
    if years == 5:
        return 16
    if years == 6:
        return 17
    if years == 7:
        return 18
    if years == 8:
        return 19
    if years <= 14:
        return 20
    if years <= 19:
        return 25
    return 30


def period_rows(empleado):
    ingreso = datetime.strptime(empleado["fecha_ingreso"], "%Y-%m-%d").date()
    salida = (
        datetime.strptime(empleado["fecha_salida"], "%Y-%m-%d").date()
        if empleado["fecha_salida"] else date.today()
    )

    rows = []
    start = ingreso
    n = 0

    while start <= salida:
        end_year = start.year + 1
        try:
            anniversary = start.replace(year=end_year)
        except ValueError:
            anniversary = start.replace(year=end_year, day=28)
        
        end = anniversary - timedelta(days=1)

        effective_end = min(end, salida)
        if effective_end < start:
            break

        service_year = n + 1
        days = annual_days(service_year - 1)

        rows.append({
            "periodo": f"{start.strftime('%d/%m/%Y')} - {effective_end.strftime('%d/%m/%Y')}",
            "desde": start,
            "hasta": effective_end,
            "dias_ganados": days,
            "numero_periodo": service_year
        })

        n += 1
        start = anniversary

    return rows


def build_kardex(empleado_id):
    db = get_db()
    empleado_document = db.collection("empleados").document(str(empleado_id)).get()
    empleado = as_row(empleado_document) if empleado_document.exists else None
    if empleado:
        empresa = db.collection("empresas").document(str(empleado["empresa_id"])).get()
        empleado["empresa_nombre"] = empresa.to_dict().get("nombre", "") if empresa.exists else ""
    
    if not user_can_view_employee(current_user(), empleado):
        return None, []

    descargos = collection_rows(db, "descargos", "fecha_descargo")
    descargos = [d for d in descargos if str(d["empleado_id"]) == str(empleado_id)]

    rows = period_rows(empleado)

    for row in rows:
        row["dias_tomados"] = 0
        row["descargos"] = []

    for d in descargos:
        periodo_str = d.get("periodo")
        elegido = None
        if periodo_str:
            for row in rows:
                if row["periodo"] == periodo_str:
                    elegido = row
                    break
        
        if not elegido and "fecha_inicio" in d:
            fecha = datetime.strptime(d["fecha_inicio"], "%Y-%m-%d").date()
            for row in rows:
                if row["desde"] <= fecha <= row["hasta"]:
                    elegido = row
                    break
            if elegido is None and rows:
                anteriores = [r for r in rows if r["desde"] <= fecha]
                elegido = anteriores[-1] if anteriores else rows[0]

        if elegido:
            elegido["dias_tomados"] += int(d.get("dias", 0))
            elegido["descargos"].append(d)

    saldo_acumulado = 0
    for row in rows:
        saldo_acumulado += row["dias_ganados"]
        saldo_acumulado -= row["dias_tomados"]
        row["saldo"] = saldo_acumulado

    return empleado, rows


# --- RUTAS DE LA APLICACIÓN ---

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"].strip()
        password = request.form["password"]

        users = list(get_db().collection("usuarios").where("username", "==", username).limit(1).stream())
        user = as_row(users[0]) if users else None

        if user and check_password_hash(user["password"], password):
            session["user_id"] = user["id"]
            return redirect(url_for("index"))
        else:
            flash("Usuario o contraseña incorrectos.")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
def index():
    user = current_user()
    if not user:
        return redirect(url_for("login"))

    if user["rol"] == "EMPLEADO":
        if user.get("empleado_id"):
            return redirect(url_for("empleado", empleado_id=user["empleado_id"]))
        return "El usuario no tiene un empleado asociado", 403

    db = get_db()
    if user["rol"] == "SUPERADMIN":
        empresas = collection_rows(db, "empresas", "nombre")
        empleados = collection_rows(db, "empleados", "nombre")
    else:
        empresa = db.collection("empresas").document(str(user["empresa_id"])).get()
        empresas = [as_row(empresa)] if empresa.exists else []
        empleados = [employee for employee in collection_rows(db, "empleados", "nombre")
                     if str(employee["empresa_id"]) == str(user["empresa_id"])]

    for employee in empleados:
        empresa = db.collection("empresas").document(str(employee["empresa_id"])).get()
        employee["empresa_nombre"] = empresa.to_dict().get("nombre", "") if empresa.exists else ""
    return render_template("index.html", user=user, empresas=empresas, empleados=empleados)


@app.route("/empresas/nueva", methods=["POST"])
def nueva_empresa():
    user = current_user()
    if not user or user["rol"] != "SUPERADMIN":
        return redirect(url_for("index"))

    nombre = request.form["nombre"].strip()
    if nombre:
        db = get_db()
        existing = list(db.collection("empresas").where("nombre", "==", nombre).limit(1).stream())
        if existing:
            flash("La empresa ya existe.")
        else:
            db.collection("empresas").add({"nombre": nombre})
    return redirect(url_for("index"))


@app.route("/empresa/<empresa_id>/reporte")
def reporte_empresa(empresa_id):
    user = current_user()
    if not user or user["rol"] == "EMPLEADO" or not user_has_access_to_empresa(empresa_id):
        return redirect(url_for("index"))

    db = get_db()
    empresa_document = db.collection("empresas").document(str(empresa_id)).get()
    if not empresa_document.exists:
        return "Empresa no encontrada", 404

    empleados = [
        employee for employee in collection_rows(db, "empleados", "nombre")
        if str(employee["empresa_id"]) == str(empresa_id)
    ]
    resumen = []
    total_ganado = total_tomado = 0
    for employee in empleados:
        _, kardex = build_kardex(employee["id"])
        ganado = sum(row["dias_ganados"] for row in kardex)
        tomado = sum(row["dias_tomados"] for row in kardex)
        resumen.append({
            "empleado": employee,
            "total_ganado": ganado,
            "total_tomado": tomado,
            "saldo": ganado - tomado,
        })
        total_ganado += ganado
        total_tomado += tomado

    return render_template(
        "reporte_empresa.html",
        empresa=as_row(empresa_document),
        resumen=resumen,
        total_ganado=total_ganado,
        total_tomado=total_tomado,
        saldo=total_ganado - total_tomado,
        user=user,
    )


@app.route("/empleado/nuevo", methods=["GET", "POST"])
def nuevo_empleado():
    user = current_user()
    if not user_can_manage(user):
        return redirect(url_for("index"))

    db = get_db()
    if user["rol"] == "SUPERADMIN":
        empresas = collection_rows(db, "empresas", "nombre")
    else:
        empresa = db.collection("empresas").document(str(user["empresa_id"])).get()
        empresas = [as_row(empresa)] if empresa.exists else []

    if request.method == "POST":
        empresa_id = request.form["empresa_id"]
        if not user_has_access_to_empresa(empresa_id):
            return redirect(url_for("index"))

        nombre = request.form["nombre"].strip()
        cedula = request.form.get("cedula", "").strip()
        cargo = request.form.get("cargo", "").strip()
        fecha_ingreso = request.form["fecha_ingreso"]
        fecha_salida = request.form.get("fecha_salida") or None
        observaciones = request.form.get("observaciones", "").strip()

        db.collection("empleados").add({
            "empresa_id": str(empresa_id), "nombre": nombre, "cedula": cedula,
            "cargo": cargo, "fecha_ingreso": fecha_ingreso,
            "fecha_salida": fecha_salida, "observaciones": observaciones
        })
        return redirect(url_for("index"))

    return render_template("empleado_form.html", empresas=empresas, user=user)


@app.route("/empleado/<empleado_id>/editar", methods=["GET", "POST"])
def editar_empleado(empleado_id):
    user = current_user()
    if not user_can_manage(user):
        return redirect(url_for("index"))

    db = get_db()
    empleado_document = db.collection("empleados").document(str(empleado_id)).get()
    empleado = as_row(empleado_document) if empleado_document.exists else None
    
    if not empleado or not user_has_access_to_empresa(empleado["empresa_id"]):
        return "Empleado no encontrado o sin permisos", 404

    if user["rol"] == "SUPERADMIN":
        empresas = collection_rows(db, "empresas", "nombre")
    else:
        empresa = db.collection("empresas").document(str(user["empresa_id"])).get()
        empresas = [as_row(empresa)] if empresa.exists else []

    if request.method == "POST":
        empresa_id = request.form["empresa_id"]
        if not user_has_access_to_empresa(empresa_id):
            return redirect(url_for("index"))

        nombre = request.form["nombre"].strip()
        cedula = request.form.get("cedula", "").strip()
        cargo = request.form.get("cargo", "").strip()
        fecha_ingreso = request.form["fecha_ingreso"]
        fecha_salida = request.form.get("fecha_salida") or None
        observaciones = request.form.get("observaciones", "").strip()

        db.collection("empleados").document(str(empleado_id)).update({
            "empresa_id": str(empresa_id), "nombre": nombre, "cedula": cedula,
            "cargo": cargo, "fecha_ingreso": fecha_ingreso,
            "fecha_salida": fecha_salida, "observaciones": observaciones
        })
        return redirect(url_for("empleado", empleado_id=empleado_id))

    return render_template("empleado_edit.html", empleado=empleado, empresas=empresas, user=user)


@app.route("/empleado/<empleado_id>")
def empleado(empleado_id):
    user = current_user()
    if not user:
        return redirect(url_for("login"))

    employee_document = get_db().collection("empleados").document(str(empleado_id)).get()
    emp = as_row(employee_document) if employee_document.exists else None
    if not user_can_view_employee(user, emp):
        return "Empleado no encontrado o sin permisos", 403

    emp, kardex = build_kardex(empleado_id)
    if not emp:
        return "Empleado no encontrado o sin permisos", 404

    total_ganado = sum(r["dias_ganados"] for r in kardex)
    total_tomado = sum(r["dias_tomados"] for r in kardex)
    saldo = total_ganado - total_tomado
    return render_template(
        "kardex.html",
        empleado=emp,
        kardex=kardex,
        total_ganado=total_ganado,
        total_tomado=total_tomado,
        saldo=saldo,
        user=user
    )


@app.route("/empleado/<empleado_id>/descargo", methods=["GET", "POST"])
def nuevo_descargo(empleado_id):
    user = current_user()
    if not user_can_manage(user):
        return redirect(url_for("index"))

    emp, kardex = build_kardex(empleado_id)
    if not emp:
        return "Empleado no encontrado o sin permisos", 404

    if request.method == "POST":
        fecha_descargo = request.form["fecha_descargo"]
        periodo = request.form["periodo"]
        fecha_inicio = request.form["fecha_inicio"]
        fecha_fin = request.form["fecha_fin"]
        motivo = request.form.get("motivo", "")
        responsable = request.form.get("responsable", "")

        inicio = datetime.strptime(fecha_inicio, "%Y-%m-%d").date()
        fin = datetime.strptime(fecha_fin, "%Y-%m-%d").date()
        dias = (fin - inicio).days + 1

        get_db().collection("descargos").add({
            "empleado_id": str(empleado_id), "fecha_descargo": fecha_descargo,
            "periodo": periodo, "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin, "dias": int(dias),
            "motivo": motivo, "responsable": responsable
        })
        return redirect(url_for("empleado", empleado_id=empleado_id))

    return render_template("descargo_form.html", empleado=emp, kardex=kardex, user=user)


@app.route("/empleado/<empleado_id>/salida", methods=["POST"])
def registrar_salida(empleado_id):
    user = current_user()
    if not user_can_manage(user):
        return redirect(url_for("index"))

    db = get_db()
    employee_document = db.collection("empleados").document(str(empleado_id)).get()
    emp = employee_document.to_dict() if employee_document.exists else None
    if not emp or not user_has_access_to_empresa(emp["empresa_id"]):
        return "Acceso denegado", 403

    fecha_salida = request.form["fecha_salida"]
    db.collection("empleados").document(str(empleado_id)).update({"fecha_salida": fecha_salida})
    return redirect(url_for("empleado", empleado_id=empleado_id))


@app.route("/descargo/<descargo_id>/eliminar", methods=["POST"])
def eliminar_descargo(descargo_id):
    user = current_user()
    if not user_can_manage(user):
        return redirect(url_for("index"))

    db = get_db()
    descargo_document = db.collection("descargos").document(str(descargo_id)).get()
    d = as_row(descargo_document) if descargo_document.exists else None
    if d:
        employee = db.collection("empleados").document(str(d["empleado_id"])).get()
        d["empresa_id"] = employee.to_dict().get("empresa_id") if employee.exists else None
    
    if d and user_has_access_to_empresa(d["empresa_id"]):
        db.collection("descargos").document(str(descargo_id)).delete()
        empleado_id = d["empleado_id"]
    else:
        empleado_id = None
    return redirect(url_for("empleado", empleado_id=empleado_id)) if empleado_id else redirect(url_for("index"))


@app.route("/descargo/<descargo_id>/pdf")
def descargar_pdf(descargo_id):
    user = current_user()
    if not user:
        return redirect(url_for("login"))

    db = get_db()
    descargo_document = db.collection("descargos").document(str(descargo_id)).get()
    descargo = as_row(descargo_document) if descargo_document.exists else None
    if descargo:
        empleado_document = db.collection("empleados").document(str(descargo["empleado_id"])).get()
        empresa_document = None
        if empleado_document.exists:
            empleado = empleado_document.to_dict()
            descargo.update({
                "nombre": empleado.get("nombre"), "cedula": empleado.get("cedula"),
                "cargo": empleado.get("cargo"), "empresa_id": empleado.get("empresa_id")
            })
            empresa_document = db.collection("empresas").document(str(descargo["empresa_id"])).get()
        descargo["empresa_nombre"] = (
            empresa_document.to_dict().get("nombre", "")
            if empresa_document and empresa_document.exists else ""
        )

    if not descargo:
        return "No autorizado", 403

    employee_document = db.collection("empleados").document(str(descargo["empleado_id"])).get()
    empleado = as_row(employee_document) if employee_document.exists else None
    if not user_can_view_employee(user, empleado):
        return "No autorizado", 403

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], alignment=1, fontSize=16, spaceAfter=15)
    subtitle_style = ParagraphStyle('SubTitleStyle', parent=styles['Heading2'], alignment=1, fontSize=12, spaceAfter=20)
    body_style = ParagraphStyle('BodyStyle', parent=styles['Normal'], fontSize=11, leading=16, spaceAfter=10)

    story.append(Paragraph(f"<b>{descargo.get('empresa_nombre', '').upper()}</b>", title_style))
    story.append(Paragraph("SOLICITUD Y COMPROBANTE DE DESCARGO DE VACACIONES", subtitle_style))
    story.append(Spacer(1, 10))

    data_info = [
        [Paragraph("<b>Colaborador:</b>", body_style), Paragraph(descargo.get('nombre', ''), body_style)],
        [Paragraph("<b>Cédula:</b>", body_style), Paragraph(descargo.get('cedula', '') or 'N/D', body_style)],
        [Paragraph("<b>Cargo:</b>", body_style), Paragraph(descargo.get('cargo', '') or 'N/D', body_style)],
        [Paragraph("<b>Fecha de Solicitud:</b>", body_style), Paragraph(descargo.get('fecha_descargo', ''), body_style)]
    ]
    t_info = Table(data_info, colWidths=[150, 350])
    t_info.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 15))

    story.append(Paragraph("<b>DETALLE DEL PERÍODO Y DESCANSO</b>", styles['Heading3']))
    story.append(Spacer(1, 5))

    data_det = [
        [Paragraph("<b>Período Correspondiente:</b>", body_style), Paragraph(descargo.get('periodo', '') or 'N/D', body_style)],
        [Paragraph("<b>Fecha de Inicio:</b>", body_style), Paragraph(descargo.get('fecha_inicio', ''), body_style)],
        [Paragraph("<b>Fecha de Finalización:</b>", body_style), Paragraph(descargo.get('fecha_fin', ''), body_style)],
        [Paragraph("<b>Total Días Tomados:</b>", body_style), Paragraph(f"<b>{descargo.get('dias', 0)} días</b>", body_style)],
        [Paragraph("<b>Motivo / Observaciones:</b>", body_style), Paragraph(descargo.get('motivo', '') or 'Ninguno', body_style)],
        [Paragraph("<b>Autorizado por:</b>", body_style), Paragraph(descargo.get('responsable', '') or 'Talento Humano', body_style)]
    ]
    t_det = Table(data_det, colWidths=[150, 350])
    t_det.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('BACKGROUND', (0,0), (0,-1), colors.whitesmoke),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_det)
    story.append(Spacer(1, 60))

    data_firmas = [
        [Paragraph("______________________________________<br/><b>Firma del Empleado</b>", ParagraphStyle('F1', alignment=1, fontSize=10)),
         Paragraph("______________________________________<br/><b>Talento Humano / Gerencia</b>", ParagraphStyle('F2', alignment=1, fontSize=10))]
    ]
    t_firmas = Table(data_firmas, colWidths=[250, 250])
    story.append(t_firmas)

    doc.build(story)
    buffer.seek(0)
    
    response = make_response(buffer.read())
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'inline; filename=comprobante_vacaciones_{descargo_id}.pdf'
    return response


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)