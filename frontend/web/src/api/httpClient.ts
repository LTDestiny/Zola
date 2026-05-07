import axios, { type AxiosRequestConfig } from "axios";
import {
  ACCESS_EXPIRES_AT_KEY,
  ACCESS_TOKEN_KEY,
  clearAuthTokens,
} from "../auth/token";
import { env } from "../shared/env";

function resolveApiBaseUrl() {
  if (env.VITE_API_URL) {
    return env.VITE_API_URL;
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname === "appassets.androidplatform.net") {
      return env.VITE_API_PROXY_TARGET ?? "https://10.18.76.36:18080";
    }

    if (window.location.port === "5173") {
      return window.location.origin;
    }

    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:18080`;
  }

  return "https://127.0.0.1:18080";
}

const defaultApiBaseUrl = resolveApiBaseUrl();
const fallbackApiBaseUrl = defaultApiBaseUrl.includes("localhost")
  ? defaultApiBaseUrl.replace("localhost", "127.0.0.1")
  : undefined;

type RetriableAxiosConfig = {
  __retriedWithLoopback?: boolean;
};

export const httpClient = axios.create({
  baseURL: defaultApiBaseUrl,
  timeout: 45000,
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAtValue = localStorage.getItem(ACCESS_EXPIRES_AT_KEY);

  if (expiresAtValue) {
    const expiresAt = Number(expiresAtValue);
    if (Number.isFinite(expiresAt) && Date.now() >= expiresAt) {
      clearAuthTokens();
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
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

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = (error?.config ?? {}) as AxiosRequestConfig &
      RetriableAxiosConfig;
    const isNetworkOrTimeoutError =
      error?.code === "ECONNABORTED" || error?.code === "ERR_NETWORK";

    if (
      fallbackApiBaseUrl &&
      isNetworkOrTimeoutError &&
      !config.__retriedWithLoopback &&
      typeof config.baseURL === "string" &&
      config.baseURL.includes("localhost")
    ) {
      config.__retriedWithLoopback = true;
      return httpClient.request({
        ...config,
        baseURL: fallbackApiBaseUrl,
        timeout: 45000,
      } as AxiosRequestConfig & RetriableAxiosConfig);
    }

    const status = error?.response?.status as number | undefined;
    if (
      status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      const serverMessage = error?.response?.data?.message as
        | string
        | undefined;
      const fallbackMessage =
        "Tai khoan da dang nhap o thiet bi khac. Vui long dang nhap lai.";
      sessionStorage.setItem(
        "zola_forced_logout_message",
        serverMessage && serverMessage.trim() ? serverMessage : fallbackMessage,
      );
      clearAuthTokens();
      window.location.replace("/login");
    }
    return Promise.reject(error);
  },
);
