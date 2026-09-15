import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { HomeRedirect, RequireAuth, RequireManager } from "./components/Guards";
import { AuthProvider } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import DescargoFormPage from "./pages/DescargoFormPage";
import EmployeeFormPage from "./pages/EmployeeFormPage";
import KardexPage from "./pages/KardexPage";
import LoginPage from "./pages/LoginPage";
import ReporteEmpresaPage from "./pages/ReporteEmpresaPage";
import UsersPage from "./pages/UsersPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route element={<HomeRedirect />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/empresa/:empresaId/reporte" element={<ReporteEmpresaPage />} />
                <Route element={<RequireManager />}>
                  <Route path="/empleado/nuevo" element={<EmployeeFormPage />} />
                  <Route path="/empleado/:empleadoId/editar" element={<EmployeeFormPage />} />
                  <Route path="/empleado/:empleadoId/descargo" element={<DescargoFormPage />} />
                  <Route path="/usuarios" element={<UsersPage />} />
                </Route>
              </Route>
              <Route path="/empleado/:empleadoId" element={<KardexPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
