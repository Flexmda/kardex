import type { Descargo, Empleado, KardexRow } from "./types";

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatPeriodDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function replaceYearSafe(date: Date, year: number): Date {
  const month = date.getMonth();
  const day = date.getDate();
  const candidate = new Date(year, month, day);
  if (candidate.getMonth() !== month) {
    return new Date(year, month, 28);
  }
  return candidate;
}

export function annualDays(years: number): number {
  if (years < 5) return 15;
  if (years === 5) return 16;
  if (years === 6) return 17;
  if (years === 7) return 18;
  if (years === 8) return 19;
  if (years <= 14) return 20;
  if (years <= 19) return 25;
  return 30;
}

export function calendarDaysInclusive(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000) + 1;
}

export function roundDays(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatDays(value: number) {
  return value.toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function proratedDays(cupo: number, start: Date, fullEnd: Date, effectiveEnd: Date) {
  const full = calendarDaysInclusive(formatIsoDate(start), formatIsoDate(fullEnd));
  const worked = calendarDaysInclusive(formatIsoDate(start), formatIsoDate(effectiveEnd));
  if (full <= 0 || worked <= 0) return 0;
  if (worked >= full) return cupo;
  return roundDays((cupo * worked) / full);
}

export function periodRows(empleado: Pick<Empleado, "fechaIngreso" | "fechaSalida">, asOf = new Date()): Omit<KardexRow, "diasTomados" | "descargos" | "saldo">[] {
  const ingreso = parseIsoDate(empleado.fechaIngreso);
  const salida = empleado.fechaSalida
    ? parseIsoDate(empleado.fechaSalida)
    : new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());

  const rows: Omit<KardexRow, "diasTomados" | "descargos" | "saldo">[] = [];
  let start = ingreso;
  let n = 0;

  while (start <= salida) {
    const endYear = start.getFullYear() + 1;
    const anniversary = replaceYearSafe(start, endYear);
    const end = addDays(anniversary, -1);
    const effectiveEnd = end < salida ? end : salida;
    if (effectiveEnd < start) break;

    const serviceYear = n + 1;
    rows.push({
      periodo: `${formatPeriodDate(start)} - ${formatPeriodDate(effectiveEnd)}`,
      desde: start,
      hasta: effectiveEnd,
      diasGanados: proratedDays(annualDays(serviceYear - 1), start, end, effectiveEnd),
      numeroPeriodo: serviceYear,
    });

    n += 1;
    start = anniversary;
  }

  return rows;
}

export function buildKardex(
  empleado: Empleado,
  descargos: Descargo[],
  asOf = new Date(),
): KardexRow[] {
  const rows: KardexRow[] = periodRows(empleado, asOf).map((row) => ({
    ...row,
    diasTomados: 0,
    descargos: [],
    saldo: 0,
  }));

  const sorted = [...descargos].sort((a, b) => a.fechaDescargo.localeCompare(b.fechaDescargo));

  for (const descargo of sorted) {
    let elegido = descargo.periodo
      ? rows.find((row) => row.periodo === descargo.periodo)
      : undefined;

    if (!elegido && descargo.fechaInicio) {
      const fecha = parseIsoDate(descargo.fechaInicio);
      elegido = rows.find((row) => row.desde <= fecha && fecha <= row.hasta);
      if (!elegido && rows.length) {
        const anteriores = rows.filter((row) => row.desde <= fecha);
        elegido = anteriores.at(-1) ?? rows[0];
      }
    }

    if (elegido) {
      elegido.diasTomados += Number(descargo.dias || 0);
      elegido.descargos.push(descargo);
    }
  }

  let saldoAcumulado = 0;
  for (const row of rows) {
    saldoAcumulado = roundDays(saldoAcumulado + row.diasGanados - row.diasTomados);
    row.saldo = saldoAcumulado;
  }

  return rows;
}

export function kardexTotals(rows: KardexRow[]) {
  const totalGanado = roundDays(rows.reduce((sum, row) => sum + row.diasGanados, 0));
  const totalTomado = roundDays(rows.reduce((sum, row) => sum + row.diasTomados, 0));
  return { totalGanado, totalTomado, saldo: roundDays(totalGanado - totalTomado) };
}
