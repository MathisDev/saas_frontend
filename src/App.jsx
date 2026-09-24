import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateNamespace from "./pages/CreateNamespace";
import NamespaceDetail from "./pages/NamespaceDetail";
import PodDetail from "./pages/PodDetail";
import Admin from "./pages/Admin";
import Organisation from "./pages/Organisation";
import Monitoring from "./pages/Monitoring";
import Console from "./pages/Console";
import Settings from "./pages/Settings";

function RequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout />;
}

function RequireAdmin() {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<CreateNamespace />} />
            <Route path="/namespaces/:name" element={<NamespaceDetail />} />
            <Route path="/namespaces/:name/pods/:pod" element={<PodDetail />} />
            <Route path="/console" element={<Console />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/organisation" element={<Organisation />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
