function looksLikeObjectStorageHost(hostname: string, port: string) {
  const lower = hostname.toLowerCase();
  return port === "9000" || lower.includes("minio") || lower.includes("s3");
}

function extractObjectKey(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.origin);

    if (parsed.pathname === "/api/v1/media/object") {
      const key = parsed.searchParams.get("key");
      return key && key.trim() ? key.trim() : null;
    }

    const directKey = parsed.searchParams.get("key");
    if (directKey && directKey.trim()) {
      return directKey.trim();
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
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
  const normalized = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!normalized) {
    return undefined;
  }

  if (normalized.startsWith("/api/v1/media/object")) {
    return normalized;
  }

  const key = extractObjectKey(normalized);
  if (!key) {
    return normalized;
  }

  return `/api/v1/media/object?key=${encodeURIComponent(key)}`;
}
