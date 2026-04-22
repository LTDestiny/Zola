import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Language = "vi" | "en";

type Dictionary = {
  [key: string]: {
    vi: string;
    en: string;
  };
};

const dictionary: Dictionary = {
  appName: { vi: "Zola", en: "Zola" },
  loginTitle: { vi: "Đăng nhập tài khoản", en: "Sign in" },
  loginSub: {
    vi: "Đăng nhập bằng email và OTP để kết nối với Zola Web",
    en: "Sign in with email OTP to access Zola Web",
  },
  loginPasswordSub: {
    vi: "Đăng nhập bằng email và mật khẩu",
    en: "Sign in with email and password",
  },
  email: { vi: "Email", en: "Email" },
  otpCode: { vi: "Mã OTP", en: "OTP code" },
  sendOtp: { vi: "Gửi OTP", en: "Send OTP" },
  verifyLogin: { vi: "Đăng nhập", en: "Sign in" },
  forgotPassword: { vi: "Quên mật khẩu", en: "Forgot password" },
  register: { vi: "Đăng ký", en: "Register" },
  createAccountTitle: { vi: "Tạo tài khoản", en: "Create account" },
  fullName: { vi: "Họ và tên", en: "Full name" },
  password: { vi: "Mật khẩu", en: "Password" },
  confirmPassword: { vi: "Nhập lại mật khẩu", en: "Confirm password" },
  passwordMismatch: { vi: "Mật khẩu xác nhận không khớp", en: "Password confirmation does not match" },
  registerOtpSent: { vi: "Mã OTP xác nhận email đã được gửi", en: "Email verification OTP has been sent" },
  verifyRegister: { vi: "Xác nhận đăng ký", en: "Verify registration" },
  loginButton: { vi: "Đăng nhập", en: "Sign in" },
  agreePolicy: {
    vi: "Tôi đồng ý với chính sách và điều khoản sử dụng",
    en: "I agree to the policy and terms of use",
  },
  readPolicy: { vi: "Đọc chính sách", en: "Read policy" },
  createAccount: { vi: "Tạo tài khoản", en: "Create account" },
  backToLogin: { vi: "Quay lại đăng nhập", en: "Back to login" },
  otpSent: { vi: "OTP đã được gửi về email", en: "OTP has been sent to your email" },
  policyTitle: { vi: "Chính sách sử dụng", en: "Usage policy" },
  policyBody: {
    vi: "Bằng việc sử dụng hệ thống, bạn đồng ý sử dụng thông tin đúng mục đích bảo mật, xác thực và vận hành dịch vụ. Một tài khoản chỉ được phép tối đa 1 phiên WEB và 1 phiên MOBILE hoạt động đồng thời.",
    en: "By using this system, you agree that your data is used for security, authentication, and service operations. One account can only have up to one active WEB session and one active MOBILE session at the same time.",
  },
  forgotTitle: { vi: "Khôi phục mật khẩu", en: "Recover password" },
  forgotSub: { vi: "Nhận OTP qua email để xác nhận", en: "Get OTP via email to verify" },
  verifyOtp: { vi: "Xác nhận OTP", en: "Verify OTP" },
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof dictionary) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("vi");

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: keyof typeof dictionary) => dictionary[key][language],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}