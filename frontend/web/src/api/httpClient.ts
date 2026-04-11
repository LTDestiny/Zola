import axios from "axios";
import { ACCESS_EXPIRES_AT_KEY, ACCESS_TOKEN_KEY, clearAuthTokens } from "../auth/token";

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
  timeout: 15000,
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAtValue = localStorage.getItem(ACCESS_EXPIRES_AT_KEY);

  if (expiresAtValue) {
    const expiresAt = Number(expiresAtValue);
    if (Number.isFinite(expiresAt) && Date.now() >= expiresAt) {
      clearAuthTokens();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return config;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
