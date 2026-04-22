import axios, { type AxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { clearAuthTokens, getAccessToken } from "@/shared/storage/authToken";
import { env } from "@/shared/env";

function resolveApiBaseUrl() {
  const explicit = env.VITE_API_URL;
  if (explicit && explicit !== "http://127.0.0.1:8080") {
    return explicit;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host) {
    return `http://${host}:8080`;
  }

  // Android emulator cannot use localhost of the dev machine directly.
  return "http://10.0.2.2:8080";
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
