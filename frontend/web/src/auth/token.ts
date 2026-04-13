export const ACCESS_TOKEN_KEY = "zola_access_token";
export const REFRESH_TOKEN_KEY = "zola_refresh_token";
export const ACCESS_EXPIRES_AT_KEY = "zola_access_expires_at";
export const SESSION_ID_KEY = "zola_session_id";

export function saveAuthTokens(input: {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessExpiresInSeconds: number;
}) {
  localStorage.setItem(ACCESS_TOKEN_KEY, input.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, input.refreshToken);
  localStorage.setItem(SESSION_ID_KEY, input.sessionId);
  const expiresAt = Date.now() + input.accessExpiresInSeconds * 1000;
  localStorage.setItem(ACCESS_EXPIRES_AT_KEY, String(expiresAt));
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_EXPIRES_AT_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getSessionId() {
  return localStorage.getItem(SESSION_ID_KEY);
}

export function isAuthenticated() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAtValue = localStorage.getItem(ACCESS_EXPIRES_AT_KEY);
  if (!token || !expiresAtValue) {
    return false;
  }

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  if (Date.now() >= expiresAt) {
    clearAuthTokens();
    return false;
  }

  return true;
}
