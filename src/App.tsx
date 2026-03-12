import "./index.css";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminResourceNewPage } from "./pages/AdminResourceNewPage";
import { AdminResourceEditPage } from "./pages/AdminResourceEditPage";
import { AdminResourcesPage } from "./pages/AdminResourcesPage";
import { AdminDirectoryUsersPage } from "./pages/AdminDirectoryUsersPage";
import { AdminDirectoryGroupsPage } from "./pages/AdminDirectoryGroupsPage";
import { AdminApprovalGroupFormPage } from "./pages/AdminApprovalGroupFormPage";
import { AdminPoliciesPage } from "./pages/AdminPoliciesPage";
import { AdminPolicyFormPage } from "./pages/AdminPolicyFormPage";
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
        path="/admin/resources/:id/edit"
        element={
          <RequireAuth>
            <AdminResourceEditPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/directory"
        element={<Navigate to="/admin/users" replace />}
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <AdminDirectoryUsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/groups"
        element={
          <RequireAuth>
            <AdminDirectoryGroupsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/groups/new"
        element={
          <RequireAuth>
            <AdminApprovalGroupFormPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/groups/:id/edit"
        element={
          <RequireAuth>
            <AdminApprovalGroupFormPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/policies"
        element={
          <RequireAuth>
            <AdminPoliciesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/policies/new"
        element={
          <RequireAuth>
            <AdminPolicyFormPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/policies/:id/edit"
        element={
          <RequireAuth>
            <AdminPolicyFormPage />
          </RequireAuth>
        }
      />
      <Route path="/admin/directory/users" element={<Navigate to="/admin/users" replace />} />
      <Route
        path="/admin/directory/groups"
        element={<Navigate to="/admin/groups" replace />}
      />
      <Route path="/admin/approval-groups" element={<Navigate to="/admin/groups" replace />} />
      <Route path="/admin/approval-groups/new" element={<Navigate to="/admin/groups/new" replace />} />
      <Route
        path="/admin/approval-groups/:id/edit"
        element={
          <RequireAuth>
            <AdminApprovalGroupFormPage />
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
      <Route path="/approvals" element={<Navigate to="/my-access" replace />} />
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
