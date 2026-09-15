import type { AuthClaims, Role } from "./types";

export function isManager(role?: Role) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function canAccessEmpresa(claims: AuthClaims | null, empresaId: string) {
  if (!claims?.role) return false;
  if (claims.role === "SUPERADMIN") return true;
  return claims.empresaId === empresaId;
}
