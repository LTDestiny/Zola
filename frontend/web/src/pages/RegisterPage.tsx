import { Link } from "react-router-dom";
import { useState } from "react";
import {
  registerWithEmail,
  toErrorMessage,
  verifyRegisterOtp,
} from "../api/authApi";
import { saveAuthTokens } from "../auth/token";
import { useLanguage } from "../i18n/language";
import toast from "react-hot-toast";

export function RegisterPage() {
  const { t, language, setLanguage } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error(t("registerMissingFields"));
      return false;
    }
    
    if (fullName.trim().length < 2) {
      toast.error(t("invalidFullName"));
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error(t("invalidEmail"));
      return false;
    }
    
    if (password.length < 8) {
      toast.error(t("passwordTooShort"));
      return false;
    }

    if (password !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return false;
    }
    
    return true;
  };

  const onRegister = async () => {
    if (otpRequired && resendCooldown > 0) {
      toast.error(t("resendOtpWait"));
      return;
    }

    if (!validateForm()) return;

    try {
      setLoading(true);
      const result = await registerWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        acceptedPolicy,
        policyVersion: "v1",
      });
      setOtpRequired(result.data.otpRequired);
      toast.success(t("registerOtpSent"));
      
      // Start cooldown when OTP is sent
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      const errMsg = toErrorMessage(error);
      const lower = errMsg.toLowerCase();
      if (lower.includes("email") && lower.includes("use")) toast.error(t("emailInUse"));
      else if (lower.includes("phone") && lower.includes("use")) toast.error(t("phoneInUse"));
      else if (lower.includes("send") || lower.includes("mail")) toast.error(t("sendOtpFailed"));
      else toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const onVerifyRegisterOtp = async () => {
    if (!otp.trim()) {
      toast.error(t("invalidOtpFormat"));
      return;
    }
    
    if (otp.trim().length !== 6 || !/^\d+$/.test(otp.trim())) {
      toast.error(t("invalidOtpFormat"));
      return;
    }

    try {
      setLoading(true);
      const result = await verifyRegisterOtp({
        email: email.trim(),
        code: otp.trim(),
        deviceName: "zola-web",
        deviceType: "WEB",
      });

      saveAuthTokens({
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        sessionId: result.data.sessionId,
        accessExpiresInSeconds: result.data.accessExpiresInSeconds,
      });
      
      toast.success(t("registerSuccess"));
      setTimeout(() => {
        window.location.href = "/chat";
      }, 1000);
    } catch (error) {
      const errMsg = toErrorMessage(error);
      const lower = errMsg.toLowerCase();
      if (lower.includes("invalid") || lower.includes("incorrect")) toast.error(t("invalidOtp"));
      else if (lower.includes("expire")) toast.error(t("expiredOtp"));
      else toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 md:py-12 bg-zola-sky flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "vi" ? "border-blue-400 text-zola-blue bg-white" : "border-slate-300 text-slate-600 bg-white"}`}
          onClick={() => setLanguage("vi")}
        >
          Tieng Viet
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "en" ? "border-blue-400 text-zola-blue bg-white" : "border-slate-300 text-slate-600 bg-white"}`}
          onClick={() => setLanguage("en")}
        >
          English
        </button>
      </div>

      <div className="text-zola-blue text-6xl font-bold leading-none tracking-tight">
        {t("appName")}
      </div>
      <p className="text-center text-slate-600">{t("createAccountTitle")}</p>

      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
        <header className="px-6 py-4 border-b border-slate-200 text-center text-2xl font-semibold text-slate-900">
          {t("register")}
        </header>

        <div className="p-6 grid gap-4">
          <label className="h-12 border-b border-slate-200 flex items-center">
            <input
              className="w-full border-none outline-none text-sm"
              type="text"
              placeholder={t("fullName")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>

          <label className="h-12 border-b border-slate-200 flex items-center">
            <input
              className="w-full border-none outline-none text-sm"
              type="email"
              placeholder={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="h-12 border-b border-slate-200 flex items-center">
            <input
              className="w-full border-none outline-none text-sm"
              type="password"
              placeholder={t("password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label className="h-12 border-b border-slate-200 flex items-center">
            <input
              className="w-full border-none outline-none text-sm"
              type="password"
              placeholder={t("confirmPassword")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          <label className="flex gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={acceptedPolicy}
              onChange={(e) => setAcceptedPolicy(e.target.checked)}
            />
            <span>{t("agreePolicy")}</span>
          </label>

          <Link
            to="/policy"
            className="text-sm text-zola-blue hover:text-blue-700 text-center"
          >
            {t("readPolicy")}
          </Link>

          <button
            className="h-11 rounded-lg bg-zola-blue text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            onClick={() => void onRegister()}
            disabled={
              loading ||
              !acceptedPolicy ||
              !email.trim() ||
              !fullName.trim() ||
              !password.trim() ||
              !confirmPassword.trim()
            }
          >
            {t("createAccount")}
          </button>

          {otpRequired && (
            <>
              <label className="h-12 border-b border-slate-200 flex items-center">
                <input
                  className="w-full border-none outline-none text-sm"
                  type="text"
                  placeholder={t("otpCode")}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </label>

              <button
                className="h-11 rounded-lg border border-zola-blue text-zola-blue font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                onClick={() => void onVerifyRegisterOtp()}
                disabled={loading || !otp.trim()}
              >
                {t("verifyRegister")}
              </button>

              <button
                className="h-11 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                onClick={() => void onRegister()}
                disabled={loading || resendCooldown > 0}
              >
                {language === "vi" ? "Gửi lại OTP" : "Resend OTP"} {resendCooldown > 0 ? `(${resendCooldown}s)` : ""}
              </button>
            </>
          )}

          {/* Remove old message display since we use toast now */}

          <div className="flex justify-center gap-2 text-sm">
            <span>{t("loginTitle")}</span>
            <Link className="text-zola-blue hover:text-blue-700" to="/login">
              {t("backToLogin")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
