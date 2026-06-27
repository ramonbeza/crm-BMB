import axios from "axios";
import { useAuthStore } from "@/store/authStore";

// No Railway, VITE_API_URL = "https://backend.up.railway.app/api/v1"
// Em dev local, fallback para relativo (proxy Vite / nginx)
const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// ── Renovação proativa ────────────────────────────────────────────────────────
// Garante que há sempre um access token válido antes de enviar qualquer request.
// Quando a página é recarregada o accessToken some da memória (não persiste),
// mas o refreshToken sobrevive no localStorage. Esta promise serializa a renovação
// para que múltiplas requests simultâneas não chamem o refresh endpoint em paralelo.

let _refreshPromise: Promise<string | null> | null = null;

async function ensureToken(): Promise<string | null> {
  const { accessToken, refreshToken, setAccessToken, logout } = useAuthStore.getState();

  if (accessToken) return accessToken;
  if (!refreshToken) return null;

  if (!_refreshPromise) {
    _refreshPromise = axios
      .post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken })
      .then(({ data }) => {
        setAccessToken(data.access_token);
        return data.access_token as string;
      })
      .catch(() => {
        logout();
        return null;
      })
      .finally(() => {
        _refreshPromise = null;
      });
  }

  return _refreshPromise;
}

// Injeta access token em cada requisição (renova se necessário)
api.interceptors.request.use(async (config) => {
  const token = await ensureToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Renova access token automaticamente quando o backend devolve 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setAccessToken, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        setAccessToken(data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
