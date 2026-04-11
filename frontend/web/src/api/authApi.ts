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

export async function registerWithEmail(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedPolicy: boolean;
  policyVersion: string;
}) {
  const response = await httpClient.post<ApiResponse<{ email: string; otpRequired: boolean }>>("/api/v1/auth/register", input);
  return response.data;
}

export async function verifyRegisterOtp(input: {
  email: string;
  code: string;
  deviceName: string;
  deviceType: "WEB" | "MOBILE";
}) {
  const response = await httpClient.post<ApiResponse<AuthTokenPayload>>("/api/v1/auth/register/verify-otp", input);
  return response.data;
}

export async function loginWithEmailPassword(input: {
  email: string;
  password: string;
  deviceName: string;
  deviceType: "WEB" | "MOBILE";
}) {
  const response = await httpClient.post<ApiResponse<AuthTokenPayload>>("/api/v1/auth/login", input);
  return response.data;
}

export async function requestForgotOtp(email: string) {
  const response = await httpClient.post<ApiResponse<{ identifier: string }>>("/api/v1/auth/forgot-password", {
    identifier: email,
    otpType: "EMAIL",
  });
  return response.data;
}

export async function verifyForgotOtp(email: string, code: string) {
  const response = await httpClient.post<ApiResponse<{ valid: boolean; message: string }>>("/api/v1/auth/verify-otp", {
    identifier: email,
    otpType: "EMAIL",
    code,
  });
  return response.data;
}

export function toErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? axiosError.message ?? "Unexpected error";
}
