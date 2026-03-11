import "./index.css";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminResourceNewPage } from "./pages/AdminResourceNewPage";
import { AdminResourcesPage } from "./pages/AdminResourcesPage";
import { AuthProvider, useAuth } from "./auth-context";
import { LoginPage } from "./pages/LoginPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { MyAccessPage } from "./pages/MyAccessPage";
import { PurchaseRequestsPage } from "./pages/PurchaseRequestsPage";
import { RequestsPage } from "./pages/RequestsPage";
import { ResourcesPage } from "./pages/ResourcesPage";

function AuthLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f7f9] text-[14px] text-[#7b8195]">
      Loading...
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return <AuthLoading />;
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  return children;
}

function RequireGuest({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return <AuthLoading />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <RequestsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/resources"
        element={
          <RequireAuth>
            <ResourcesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/resources"
        element={
          <RequireAuth>
            <AdminResourcesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/resources/new"
        element={
          <RequireAuth>
            <AdminResourceNewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-requests"
        element={
          <RequireAuth>
            <PurchaseRequestsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/requests"
        element={
          <RequireAuth>
            <RequestsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/audit-log"
        element={
          <RequireAuth>
            <AuditLogPage />
          </RequireAuth>
        }
      />
      <Route
        path="/my-access"
        element={
          <RequireAuth>
            <MyAccessPage />
          </RequireAuth>
        }
      />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
