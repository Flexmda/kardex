import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db } from "../lib/firebase";
import type { AuthClaims, Role, UserProfile } from "../lib/types";

type AuthState = {
  loading: boolean;
  user: User | null;
  profile: UserProfile | null;
  claims: AuthClaims | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setProfile(null);
        setClaims(null);
        setLoading(false);
        return;
      }
      try {
        const token = await next.getIdTokenResult(true);
        const nextClaims: AuthClaims = {
          role: token.claims.role as Role | undefined,
          empresaId: token.claims.empresaId as string | undefined,
          empleadoId: token.claims.empleadoId as string | undefined,
        };
        setClaims(nextClaims);
        const snap = await getDoc(doc(db, "users", next.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            id: next.uid,
            email: String(data.email || next.email || ""),
            displayName: String(data.displayName || next.displayName || ""),
            role: (data.role as Role) || nextClaims.role || "EMPLEADO",
            empresaId: data.empresaId ? String(data.empresaId) : null,
            empleadoId: data.empleadoId ? String(data.empleadoId) : null,
          });
        } else {
          setProfile({
            id: next.uid,
            email: next.email || "",
            displayName: next.displayName || "",
            role: nextClaims.role || "EMPLEADO",
            empresaId: nextClaims.empresaId || null,
            empleadoId: nextClaims.empleadoId || null,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo leer la sesión");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user,
      profile,
      claims,
      error,
      login: async (email, password) => {
        setError(null);
        await signInWithEmailAndPassword(auth, email, password);
      },
      logout: async () => {
        await signOut(auth);
      },
    }),
    [loading, user, profile, claims, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
