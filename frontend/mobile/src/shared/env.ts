import Constants from "expo-constants";

function getEnv(key: string, fallback?: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];

  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  return fallback;
}

export const env = {
  VITE_API_URL: getEnv("VITE_API_URL", "http://127.0.0.1:8080"),
  VITE_WS_URL: getEnv("VITE_WS_URL", "ws://localhost:8083/ws"),
  VITE_WEBRTC_ICE_SERVERS: getEnv("VITE_WEBRTC_ICE_SERVERS"),
  VITE_WEBRTC_FORCE_RELAY: getEnv("VITE_WEBRTC_FORCE_RELAY", "false"),
  VITE_CALL_DEBUG: getEnv("VITE_CALL_DEBUG", "true"),
};

export default env;
