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
  loginTitle: { vi: "Dang nhap tai khoan", en: "Sign in" },
  loginSub: {
    vi: "Dang nhap bang email va OTP de ket noi voi Zola Web",
    en: "Sign in with email OTP to access Zola Web",
  },
  loginPasswordSub: {
    vi: "Dang nhap bang email va mat khau",
    en: "Sign in with email and password",
  },
  email: { vi: "Email", en: "Email" },
  otpCode: { vi: "Ma OTP", en: "OTP code" },
  sendOtp: { vi: "Gui OTP", en: "Send OTP" },
  verifyLogin: { vi: "Dang nhap", en: "Sign in" },
  forgotPassword: { vi: "Quen mat khau", en: "Forgot password" },
  register: { vi: "Dang ky", en: "Register" },
  createAccountTitle: { vi: "Tao tai khoan", en: "Create account" },
  fullName: { vi: "Ho va ten", en: "Full name" },
  password: { vi: "Mat khau", en: "Password" },
  confirmPassword: { vi: "Nhap lai mat khau", en: "Confirm password" },
  passwordMismatch: { vi: "Mat khau xac nhan khong khop", en: "Password confirmation does not match" },
  registerOtpSent: { vi: "Ma OTP xac nhan email da duoc gui", en: "Email verification OTP has been sent" },
  verifyRegister: { vi: "Xac nhan dang ky", en: "Verify registration" },
  loginButton: { vi: "Dang nhap", en: "Sign in" },
  agreePolicy: {
    vi: "Toi dong y voi chinh sach va dieu khoan su dung",
    en: "I agree to the policy and terms of use",
  },
  readPolicy: { vi: "Doc chinh sach", en: "Read policy" },
  createAccount: { vi: "Tao tai khoan", en: "Create account" },
  backToLogin: { vi: "Quay lai dang nhap", en: "Back to login" },
  otpSent: { vi: "OTP da duoc gui ve email", en: "OTP has been sent to your email" },
  policyTitle: { vi: "Chinh sach su dung", en: "Usage policy" },
  policyBody: {
    vi: "Bang viec su dung he thong, ban dong y su dung thong tin dung muc dich bao mat, xac thuc va van hanh dich vu. Mot tai khoan chi duoc phep toi da 1 phien WEB va 1 phien MOBILE hoat dong dong thoi.",
    en: "By using this system, you agree that your data is used for security, authentication, and service operations. One account can only have up to one active WEB session and one active MOBILE session at the same time.",
  },
  forgotTitle: { vi: "Khoi phuc mat khau", en: "Recover password" },
  forgotSub: { vi: "Nhan OTP qua email de xac nhan", en: "Get OTP via email to verify" },
  verifyOtp: { vi: "Xac nhan OTP", en: "Verify OTP" },
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
