import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ClientFormPage } from "@/pages/ClientFormPage";
import { MeetingsPage } from "@/pages/MeetingsPage";
import { AttendancesPage } from "@/pages/AttendancesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clientes" element={<ClientsPage />} />
              <Route path="/clientes/novo" element={<ClientFormPage />} />
              <Route path="/clientes/:id" element={<ClientFormPage />} />
              <Route path="/agenda" element={<MeetingsPage />} />
              <Route path="/atendimentos" element={<AttendancesPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
