import { Link } from "react-router-dom";
import { useState } from "react";
import {
  registerWithEmail,
  toErrorMessage,
  verifyRegisterOtp,
} from "../api/authApi";
import { saveAuthTokens } from "../auth/token";
import { useLanguage } from "../i18n/language";

export function RegisterPage() {
  const { t, language, setLanguage } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (password !== confirmPassword) {
      setMessage(t("passwordMismatch"));
      return;
    }

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
      setMessage(t("registerOtpSent"));
    } catch (error) {
      setMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onVerifyRegisterOtp = async () => {
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
      window.location.href = "/chat";
    } catch (error) {
      setMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 md:py-12 bg-zalo-sky flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "vi" ? "border-blue-400 text-zalo-blue bg-white" : "border-slate-300 text-slate-600 bg-white"}`}
          onClick={() => setLanguage("vi")}
        >
          Tieng Viet
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "en" ? "border-blue-400 text-zalo-blue bg-white" : "border-slate-300 text-slate-600 bg-white"}`}
          onClick={() => setLanguage("en")}
        >
          English
        </button>
      </div>

      <div className="text-zalo-blue text-6xl font-bold leading-none tracking-tight">
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
            className="text-sm text-zalo-blue hover:text-blue-700 text-center"
          >
            {t("readPolicy")}
          </Link>

          <button
            className="h-11 rounded-lg bg-zalo-blue text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="h-11 rounded-lg border border-zalo-blue text-zalo-blue font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={loading}
              >
                {language === "vi" ? "Gui lai OTP" : "Resend OTP"}
              </button>
            </>
          )}

          {message && (
            <p className="m-0 p-3 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-sm">
              {message}
            </p>
          )}

          <div className="flex justify-center gap-2 text-sm">
            <span>{t("loginTitle")}</span>
            <Link className="text-zalo-blue hover:text-blue-700" to="/login">
              {t("backToLogin")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
