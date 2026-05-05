function getEnv(key: keyof ImportMetaEnv, fallback?: string): string | undefined {
  const value = import.meta.env[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return fallback;
}

export const env = {
  VITE_API_URL: getEnv("VITE_API_URL"),
  VITE_WS_URL: getEnv("VITE_WS_URL"),
  VITE_WEBRTC_ICE_SERVERS: getEnv("VITE_WEBRTC_ICE_SERVERS"),
  VITE_WEBRTC_FORCE_RELAY: getEnv("VITE_WEBRTC_FORCE_RELAY", "false"),
  VITE_CALL_DEBUG: getEnv("VITE_CALL_DEBUG", "true"),
};

export default env;
