import { jsPDF } from "jspdf";
import type { Descargo, Empleado } from "./types";

export function downloadDescargoPdf(empleado: Empleado, descargo: Descargo) {
  const doc = new jsPDF();
  const empresa = (empleado.empresaNombre || "").toUpperCase();
  let y = 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(empresa || "EMPRESA", 105, y, { align: "center" });
  y += 10;
  doc.setFontSize(12);
  doc.text("SOLICITUD Y COMPROBANTE DE DESCARGO DE VACACIONES", 105, y, { align: "center" });
  y += 16;

  doc.setFontSize(11);
  const rows: Array<[string, string]> = [
    ["Colaborador:", empleado.nombre],
    ["Cédula:", empleado.cedula || "N/D"],
    ["Cargo:", empleado.cargo || "N/D"],
    ["Fecha de Solicitud:", descargo.fechaDescargo],
    ["Período Correspondiente:", descargo.periodo || "N/D"],
    ["Fecha de Inicio:", descargo.fechaInicio],
    ["Fecha de Finalización:", descargo.fechaFin],
    ["Total Días Tomados:", `${descargo.dias} días`],
    ["Motivo / Observaciones:", descargo.motivo || "Ninguno"],
    ["Autorizado por:", descargo.responsable || "Talento Humano"],
  ];

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, 110);
    doc.text(lines, 80, y);
    y += Math.max(8, lines.length * 6);
  }

  y += 24;
  doc.line(25, y, 90, y);
  doc.line(120, y, 185, y);
  y += 6;
  doc.setFontSize(10);
  doc.text("Firma del Empleado", 57, y, { align: "center" });
  doc.text("Talento Humano / Gerencia", 152, y, { align: "center" });

  doc.save(`comprobante_vacaciones_${descargo.id}.pdf`);
}
