import axios, { type AxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { clearAuthTokens, getAccessToken } from "@/shared/storage/authToken";

const defaultApiBaseUrl =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://192.168.2.93:8080";

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
