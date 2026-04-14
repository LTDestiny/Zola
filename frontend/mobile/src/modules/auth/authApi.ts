import { AxiosError } from "axios";
import { httpClient } from "@/modules/chat/api/httpClient";
import type { ApiResponse, AuthTokenPayload, UserProfile } from "@/shared/types/api";

export async function loginWithEmailPassword(input: {
  email: string;
  password: string;
  deviceName: string;
  deviceType: "WEB" | "MOBILE";
}) {
  const response = await httpClient.post<ApiResponse<AuthTokenPayload>>(
    "/api/v1/auth/login",
    input,
  );
  return response.data;
}

export async function registerWithEmail(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedPolicy: boolean;
  policyVersion: string;
}) {
  const response = await httpClient.post<ApiResponse<{ email: string; otpRequired: boolean }>>(
    "/api/v1/auth/register",
    input,
  );
  return response.data;
}

export async function getUserSummary(userId: string) {
  const response = await httpClient.get<ApiResponse<UserProfile>>(`/api/v1/users/${userId}/summary`);
  return response.data;
}

export function toErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ message?: string; error?: string }>;
  return axiosError.response?.data?.message ?? axiosError.response?.data?.error ?? axiosError.message ?? "Unexpected error";
}
