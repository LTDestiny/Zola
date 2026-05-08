import { env } from "@/shared/env";

export function getInitials(name?: string | null) {
  const normalized = (name ?? "User").trim();
  if (!normalized) return "U";

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function resolveMediaUrl(rawUrl?: string | null) {
  const value = rawUrl?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;

  const baseUrl = env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  if (!baseUrl) return value;
  return `${baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
}

export function normalizeGenderLabel(value?: string | null) {
  switch ((value ?? "").toUpperCase()) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    case "OTHER":
      return "Other";
    default:
      return "Not set";
  }
}
