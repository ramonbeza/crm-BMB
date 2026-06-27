import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

export function ProtectedRoute() {
  const { isAuthenticated, accessToken, refreshToken, setAccessToken, logout } = useAuthStore();

  // Controla se ainda estamos tentando restaurar a sessão via refresh token
  const [bootstrapping, setBootstrapping] = useState(!accessToken && Boolean(refreshToken));

  useEffect(() => {
    if (!accessToken && refreshToken) {
      // Ao recarregar a página o accessToken some da memória — renovamos aqui
      axios
        .post("/api/v1/auth/refresh", { refresh_token: refreshToken })
        .then(({ data }) => {
          setAccessToken(data.access_token);
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setBootstrapping(false);
        });
    } else {
      setBootstrapping(false);
    }
  }, []); // executa apenas uma vez, na montagem

  if (bootstrapping) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-7 h-7 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
