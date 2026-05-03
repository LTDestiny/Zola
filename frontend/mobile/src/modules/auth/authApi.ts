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

export async function verifyRegisterOtp(input: {
  email: string;
  code: string;
  deviceName: string;
  deviceType: "WEB" | "MOBILE";
}) {
  const response = await httpClient.post<ApiResponse<AuthTokenPayload>>(
    "/api/v1/auth/register/verify-otp",
    input,
  );
  return response.data;
}

export async function requestForgotOtp(email: string) {
  const response = await httpClient.post<ApiResponse<{ identifier: string }>>(
    "/api/v1/auth/forgot-password",
    { identifier: email.trim().toLowerCase(), otpType: "EMAIL" },
  );
  return response.data;
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const response = await httpClient.post<ApiResponse<{ ok: boolean }>>(
    "/api/v1/auth/reset-password",
    {
      identifier: email.trim().toLowerCase(),
      otpType: "EMAIL",
      code,
      newPassword,
    },
  );
  return response.data;
}

export function toErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ message?: string; error?: string }>;
  
  if (axiosError.code === "ERR_NETWORK" || axiosError.message === "Network Error") {
    return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và đảm bảo backend đang chạy.";
  }
  
  if (axiosError.code === "ECONNABORTED") {
    return "Kết nối bị quá hạn (timeout). Vui lòng thử lại.";
  }

  return axiosError.response?.data?.message ?? axiosError.response?.data?.error ?? axiosError.message ?? "Lỗi không xác định";
}
