export type Role = "SUPERADMIN" | "ADMIN" | "EMPLEADO";

export type AuthClaims = {
  role?: Role;
  empresaId?: string;
  empleadoId?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  empresaId: string | null;
  empleadoId: string | null;
};

export type Empresa = {
  id: string;
  nombre: string;
};

export type Empleado = {
  id: string;
  empresaId: string;
  nombre: string;
  cedula: string;
  cargo: string;
  fechaIngreso: string;
  fechaSalida: string | null;
  observaciones: string;
  empresaNombre?: string;
};

export type Descargo = {
  id: string;
  empleadoId: string;
  empresaId: string;
  fechaDescargo: string;
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  motivo: string;
  responsable: string;
};

export type KardexRow = {
  periodo: string;
  desde: Date;
  hasta: Date;
  diasGanados: number;
  numeroPeriodo: number;
  diasTomados: number;
  descargos: Descargo[];
  saldo: number;
};
