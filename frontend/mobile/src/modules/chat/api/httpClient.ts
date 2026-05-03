import axios, { type AxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { clearAuthTokens, getAccessToken } from "@/shared/storage/authToken";
import { env } from "@/shared/env";

function resolveApiBaseUrl() {
  const explicit = env.VITE_API_URL;
  
  // If explicitly set to something that is NOT a local/stale IP, use it.
  // We exclude 127.0.0.1 and the potentially stale IP from app.json
  if (explicit && explicit !== "http://127.0.0.1:8080" && explicit !== "http://172.20.10.2:8080") {
    return explicit;
  }

  // Try to get host from Expo's dev server URI
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) {
    console.log(`[httpClient] Resolved API host from Expo: ${host}`);
    return `http://${host}:8080`;
  }

  // Fallback for Android emulator
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8080";
  }

  return "http://127.0.0.1:8080";
}

const defaultApiBaseUrl = resolveApiBaseUrl();

export const httpClient = axios.create({
  baseURL: defaultApiBaseUrl,
  timeout: 45000,
});

httpClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status as number | undefined;
    const config = (error?.config ?? {}) as AxiosRequestConfig & {
      __alreadyLogout?: boolean;
    };

    if (status === 401 && !config.__alreadyLogout) {
      config.__alreadyLogout = true;
      await clearAuthTokens();
    }

    return Promise.reject(error);
  },
);
