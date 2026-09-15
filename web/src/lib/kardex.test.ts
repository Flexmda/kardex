import { describe, expect, it } from "vitest";
import { annualDays, buildKardex, calendarDaysInclusive, periodRows, proratedDays } from "./kardex";
import type { Descargo, Empleado } from "./types";

const empleadoBase: Empleado = {
  id: "1",
  empresaId: "e1",
  nombre: "Ana",
  cedula: "010",
  cargo: "Analista",
  fechaIngreso: "2020-01-15",
  fechaSalida: null,
  observaciones: "",
};

function descargo(partial: Partial<Descargo> & Pick<Descargo, "periodo" | "fechaInicio" | "fechaFin" | "dias">): Descargo {
  return {
    id: partial.id ?? "d1",
    empleadoId: "1",
    empresaId: "e1",
    fechaDescargo: partial.fechaDescargo ?? "2021-02-01",
    motivo: "",
    responsable: "",
    ...partial,
  };
}

describe("annualDays", () => {
  it("sigue la escala documentada (años de servicio completos = serviceYear - 1)", () => {
    expect(annualDays(0)).toBe(15);
    expect(annualDays(4)).toBe(15);
    expect(annualDays(5)).toBe(16);
    expect(annualDays(6)).toBe(17);
    expect(annualDays(7)).toBe(18);
    expect(annualDays(8)).toBe(19);
    expect(annualDays(9)).toBe(20);
    expect(annualDays(14)).toBe(20);
    expect(annualDays(15)).toBe(25);
    expect(annualDays(19)).toBe(25);
    expect(annualDays(20)).toBe(30);
  });
});

describe("calendarDaysInclusive", () => {
  it("cuenta días calendario como Flask", () => {
    expect(calendarDaysInclusive("2024-01-01", "2024-01-01")).toBe(1);
    expect(calendarDaysInclusive("2024-01-01", "2024-01-10")).toBe(10);
  });
});

describe("periodRows", () => {
  it("genera un período por aniversario hasta asOf", () => {
    const rows = periodRows(empleadoBase, new Date(2022, 5, 1));
    expect(rows).toHaveLength(3);
    expect(rows[0].periodo).toBe("15/01/2020 - 14/01/2021");
    expect(rows[0].diasGanados).toBe(15);
    expect(rows[1].periodo).toBe("15/01/2021 - 14/01/2022");
    expect(rows[2].periodo).toBe("15/01/2022 - 01/06/2022");
    expect(rows[2].diasGanados).toBe(
      proratedDays(15, new Date(2022, 0, 15), new Date(2023, 0, 14), new Date(2022, 5, 1)),
    );
  });

  it("deja el cupo completo en períodos cerrados y prorratea el abierto", () => {
    const rows = periodRows({ fechaIngreso: "2015-01-01", fechaSalida: null }, new Date(2026, 8, 15));
    expect(rows).toHaveLength(12);
    expect(rows[10].diasGanados).toBe(20);
    expect(rows[11].periodo).toBe("01/01/2026 - 15/09/2026");
    expect(rows[11].diasGanados).toBe(
      proratedDays(20, new Date(2026, 0, 1), new Date(2026, 11, 31), new Date(2026, 8, 15)),
    );
    expect(rows[11].diasGanados).toBe(14.14);
  });

  it("corta el último período en fecha de salida", () => {
    const rows = periodRows(
      { ...empleadoBase, fechaSalida: "2021-06-30" },
      new Date(2024, 0, 1),
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].periodo).toBe("15/01/2021 - 30/06/2021");
  });

  it("usa 28 de febrero cuando el aniversario cae en 29-feb de año no bisiesto", () => {
    const rows = periodRows(
      { fechaIngreso: "2020-02-29", fechaSalida: "2021-03-01" },
      new Date(2021, 2, 1),
    );
    expect(rows[0].periodo).toBe("29/02/2020 - 27/02/2021");
    expect(rows[1].periodo).toBe("28/02/2021 - 01/03/2021");
  });
});

describe("buildKardex", () => {
  it("imputa el descargo por texto de período", () => {
    const rows = buildKardex(
      empleadoBase,
      [
        descargo({
          periodo: "15/01/2020 - 14/01/2021",
          fechaInicio: "2020-07-01",
          fechaFin: "2020-07-10",
          dias: 10,
        }),
      ],
      new Date(2021, 0, 20),
    );
    expect(rows[0].diasTomados).toBe(10);
    expect(rows[0].descargos).toHaveLength(1);
    expect(rows[0].saldo).toBe(5);
    expect(rows[1].diasGanados).toBe(
      proratedDays(15, new Date(2021, 0, 15), new Date(2022, 0, 14), new Date(2021, 0, 20)),
    );
    expect(rows[1].saldo).toBe(5.25);
  });

  it("si el período no coincide, usa fechaInicio", () => {
    const rows = buildKardex(
      empleadoBase,
      [
        descargo({
          id: "d2",
          periodo: "periodo-inexistente",
          fechaInicio: "2021-03-10",
          fechaFin: "2021-03-12",
          dias: 3,
        }),
      ],
      new Date(2021, 5, 1),
    );
    expect(rows[1].diasTomados).toBe(3);
    expect(rows[0].diasTomados).toBe(0);
  });
});
