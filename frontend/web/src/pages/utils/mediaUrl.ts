function looksLikeObjectStorageHost(hostname: string, port: string) {
  const lower = hostname.toLowerCase();
  return port === "9000" || lower.includes("minio") || lower.includes("s3");
}

import { env } from "../../shared/env";

const DEFAULT_API_BASE_URL = env.VITE_API_URL ?? "http://127.0.0.1:8080";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

function resolveApiBaseCandidates() {
  const primary = normalizeBaseUrl(DEFAULT_API_BASE_URL);
  const candidates = [primary];
  if (primary.includes("localhost")) {
    candidates.push(primary.replace("localhost", "127.0.0.1"));
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

const API_BASE_CANDIDATES = resolveApiBaseCandidates();

function buildGatewayMediaPath(objectKey: string) {
  return `/api/v1/media/object?key=${encodeURIComponent(objectKey)}`;
}

function buildGatewayMediaCandidates(objectKey: string) {
  const relativePath = buildGatewayMediaPath(objectKey);
  const absoluteCandidates = API_BASE_CANDIDATES.map((baseUrl) => `${baseUrl}${relativePath}`);
  return [...absoluteCandidates, relativePath];
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeObjectKey(rawKey: string | null): string | null {
  const normalized = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!normalized) {
    return null;
  }

  const decoded = safeDecode(normalized).replace(/^\/+/, "");
  return decoded || null;
}

function extractObjectKey(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.origin);

    if (parsed.pathname === "/api/v1/media/object") {
      return normalizeObjectKey(parsed.searchParams.get("key"));
    }

    const queryKey = normalizeObjectKey(parsed.searchParams.get("key"));
    if (queryKey) {
      return queryKey;
    }

    const normalizedPath = parsed.pathname.replace(/^\/+/, "");
    const decodedPath = safeDecode(normalizedPath);
    if (!decodedPath) {
      return null;
    }

    if (decodedPath.startsWith("chat/")) {
      return decodedPath;
    }

    const nestedChatIndex = decodedPath.indexOf("/chat/");
    if (nestedChatIndex >= 0) {
      return decodedPath.slice(nestedChatIndex + 1);
    }

    const segments = decodedPath.split("/").filter(Boolean);
    if (segments.length === 0) {
      return null;
    }

    const chatIndex = segments.indexOf("chat");
    if (chatIndex >= 0) {
      return segments.slice(chatIndex).join("/");
    }

    if (looksLikeObjectStorageHost(parsed.hostname, parsed.port) && segments.length > 1) {
      // Path-style S3/MinIO URL: /<bucket>/<object-key>
      return segments.slice(1).join("/");
    }

    return null;
  } catch {
    return null;
  }
}

export function resolveMediaUrl(rawUrl?: string | null): string | undefined {
  const [firstCandidate] = resolveMediaCandidates(rawUrl);
  return firstCandidate;
}

export function resolveMediaCandidates(rawUrl?: string | null): string[] {
  const normalized = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!normalized) {
    return [];
  }

  const candidates: string[] = [];

  const pushUnique = (value: string | null | undefined) => {
    const next = typeof value === "string" ? value.trim() : "";
    if (!next) {
      return;
    }
    if (!candidates.includes(next)) {
      candidates.push(next);
    }
  };

  if (normalized.startsWith("/api/v1/media/object")) {
    const key = extractObjectKey(normalized);
    if (key) {
      buildGatewayMediaCandidates(key).forEach((candidate) => {
        pushUnique(candidate);
      });
    }
    API_BASE_CANDIDATES.forEach((baseUrl) => {
      pushUnique(`${baseUrl}${normalized}`);
    });
    pushUnique(normalized);
    return candidates;
  }

  const key = extractObjectKey(normalized);
  if (key) {
    buildGatewayMediaCandidates(key).forEach((candidate) => {
      pushUnique(candidate);
    });
  }

  pushUnique(normalized);
  return candidates;
}
