type GenericEnvMap = Record<string, unknown>;

function readValue(source: GenericEnvMap | undefined, key: string): string | undefined {
  const raw = source?.[key];
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getEnv(key: string, fallback?: string): string | undefined {
  if (typeof globalThis !== "undefined") {
    const viteLikeEnv = readValue((globalThis as GenericEnvMap).__VITE_ENV__ as GenericEnvMap | undefined, key);
    if (viteLikeEnv) {
      return viteLikeEnv;
    }

    const expoExtra = readValue(
      ((globalThis as GenericEnvMap).__EXPO_CONSTANTS__ as GenericEnvMap | undefined)?.expoConfig as GenericEnvMap | undefined,
      "extra",
    );

    if (typeof expoExtra === "string") {
      try {
        const parsed = JSON.parse(expoExtra) as GenericEnvMap;
        const value = readValue(parsed, key);
        if (value) {
          return value;
        }
      } catch {
        // Ignore invalid JSON in runtime-injected extra.
      }
    } else {
      const extraMap = (
        ((globalThis as GenericEnvMap).__EXPO_CONSTANTS__ as GenericEnvMap | undefined)?.expoConfig as GenericEnvMap | undefined
      )?.extra as GenericEnvMap | undefined;
      const value = readValue(extraMap, key);
      if (value) {
        return value;
      }
    }
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
