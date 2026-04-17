import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const ACCESS_TOKEN_KEY = "zola_access_token";
export const REFRESH_TOKEN_KEY = "zola_refresh_token";
export const ACCESS_EXPIRES_AT_KEY = "zola_access_expires_at";
export const SESSION_ID_KEY = "zola_session_id";

async function setValue(key: string, value: string) {
  await SecureStore.setItemAsync(key, value).catch(() => AsyncStorage.setItem(key, value));
}

async function getValue(key: string) {
  const secure = await SecureStore.getItemAsync(key).catch(() => null);
  if (secure) return secure;
  return AsyncStorage.getItem(key);
}

async function removeValue(key: string) {
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
  await AsyncStorage.removeItem(key);
}

export async function saveAuthTokens(input: {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessExpiresInSeconds: number;
}) {
  const expiresAt = Date.now() + input.accessExpiresInSeconds * 1000;
  await Promise.all([
    setValue(ACCESS_TOKEN_KEY, input.accessToken),
    setValue(REFRESH_TOKEN_KEY, input.refreshToken),
    setValue(SESSION_ID_KEY, input.sessionId),
    setValue(ACCESS_EXPIRES_AT_KEY, String(expiresAt)),
  ]);
}

export async function clearAuthTokens() {
  await Promise.all([
    removeValue(ACCESS_TOKEN_KEY),
    removeValue(REFRESH_TOKEN_KEY),
    removeValue(SESSION_ID_KEY),
    removeValue(ACCESS_EXPIRES_AT_KEY),
  ]);
}

export async function getAccessToken() {
  return getValue(ACCESS_TOKEN_KEY);
}

export async function isAuthenticated() {
  const [token, expiresAtValue] = await Promise.all([
    getValue(ACCESS_TOKEN_KEY),
    getValue(ACCESS_EXPIRES_AT_KEY),
  ]);

  if (!token || !expiresAtValue) return false;
  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    await clearAuthTokens();
    return false;
  }
  return true;
}
