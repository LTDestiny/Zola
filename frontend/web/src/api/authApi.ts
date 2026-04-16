import { AxiosError } from "axios";
import { httpClient } from "./httpClient";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type AuthTokenPayload = {
  userId: string;
  sessionId: string;
  accessToken: string;
  accessExpiresInSeconds: number;
  refreshToken: string;
  refreshExpiresInSeconds: number;
};

type ErrorResponseShape = {
  message?: string;
  error?: string;
  errors?: Array<{ defaultMessage?: string }>;
};

export async function registerWithEmail(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedPolicy: boolean;
  policyVersion: string;
}) {
  const response = await httpClient.post<
    ApiResponse<{ email: string; otpRequired: boolean }>
  >("/api/v1/auth/register", input);
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

export async function getUserSummary(userId: string) {
  const response = await httpClient.get<
    ApiResponse<{
      id: string;
      fullName: string;
      email: string | null;
      avatarUrl: string | null;
      gender: string | null;
      birthdate: string | null;
    }>
  >(`/api/v1/users/${userId}/summary`);
  return response.data;
}

export async function requestForgotOtp(email: string) {
  const response = await httpClient.post<ApiResponse<{ identifier: string }>>(
    "/api/v1/auth/forgot-password",
    {
      identifier: email,
      otpType: "EMAIL",
    },
  );
  return response.data;
}

export async function verifyForgotOtp(email: string, code: string) {
  const response = await httpClient.post<
    ApiResponse<{ valid: boolean; message: string }>
  >("/api/v1/auth/verify-otp", {
    identifier: email,
    otpType: "EMAIL",
    code,
  });
  return response.data;
}

export function toErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ErrorResponseShape>;
  if (axiosError.code === "ECONNABORTED") {
    return "Ket noi den may chu bi timeout. Vui long thu lai sau vai giay.";
  }

  if (axiosError.code === "ERR_NETWORK") {
    return "Khong the ket noi den may chu. Hay kiem tra backend va URL API.";
  }

  const payload = axiosError.response?.data;
  const firstValidationError = payload?.errors?.[0]?.defaultMessage;
  const backendMessage =
    payload?.message ?? firstValidationError ?? payload?.error;

  if (typeof backendMessage === "string") {
    const normalized = backendMessage.toLowerCase();
    if (
      normalized.includes("smtp authentication failed") ||
      normalized.includes("authentication failed")
    ) {
      return "SMTP dang bi sai tai khoan/mat khau. Neu dung Gmail, hay dung App Password (16 ky tu), khong dung mat khau dang nhap thuong.";
    }
  }

  return backendMessage ?? axiosError.message ?? "Unexpected error";
}
