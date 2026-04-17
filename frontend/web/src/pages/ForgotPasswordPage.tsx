import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { requestForgotOtp, resetPassword, toErrorMessage } from "../api/authApi";
import { useLanguage } from "../i18n/language";

export function ForgotPasswordPage() {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "otp" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onRequestOtp = async () => {
    try {
      setLoading(true);
      setMessage("");
      await requestForgotOtp(email.trim());
      setStep("otp");
      setMessage(t("otpSent"));
    } catch (error) {
      setMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onContinueToReset = () => {
    if (!code.trim()) {
      setMessage("Vui lòng nhập mã OTP");
      return;
    }
    setMessage("");
    setStep("reset");
  };

  const onResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      await resetPassword(email.trim(), code.trim(), newPassword);
      navigate("/login");
    } catch (error) {
      setMessage(toErrorMessage(error));
      // If OTP error, go back to OTP step
      setStep("otp");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 md:py-12 bg-zola-sky flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <button type="button" className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "vi" ? "border-blue-400 text-zola-blue bg-white" : "border-slate-300 text-slate-600 bg-white"}`} onClick={() => setLanguage("vi")}>
          Tieng Viet
        </button>
        <button type="button" className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "en" ? "border-blue-400 text-zola-blue bg-white" : "border-slate-300 text-slate-600 bg-white"}`} onClick={() => setLanguage("en")}>
          English
        </button>
      </div>

      <div className="text-zola-blue text-6xl font-bold leading-none tracking-tight">{t("appName")}</div>
      <p className="text-center text-slate-600">{t("forgotSub")}</p>

      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
        <header className="px-6 py-4 border-b border-slate-200 text-center text-2xl font-semibold text-slate-900">{t("forgotTitle")}</header>

        <div className="p-6 grid gap-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <span className={step === "email" ? "text-zola-blue font-semibold" : ""}>1. Email</span>
            <span>→</span>
            <span className={step === "otp" ? "text-zola-blue font-semibold" : ""}>2. OTP</span>
            <span>→</span>
            <span className={step === "reset" ? "text-zola-blue font-semibold" : ""}>3. Mật khẩu mới</span>
          </div>

          {/* Step 1: Email */}
          {step === "email" && (
            <>
              <label className="h-12 border-b border-slate-200 flex items-center">
                <input className="w-full border-none outline-none text-sm" type="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) void onRequestOtp(); }} />
              </label>
              <button className="h-11 rounded-lg bg-zola-blue text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="button" onClick={() => void onRequestOtp()} disabled={loading || !email.trim()}>
                {loading ? "Đang gửi..." : t("sendOtp")}
              </button>
            </>
          )}

          {/* Step 2: OTP */}
          {step === "otp" && (
            <>
              <p className="text-sm text-slate-600 text-center">Mã OTP đã được gửi tới <strong>{email}</strong></p>
              <label className="h-12 border-b border-slate-200 flex items-center">
                <input className="w-full border-none outline-none text-sm" type="text" placeholder={t("otpCode")} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onContinueToReset(); }} autoFocus />
              </label>
              <button className="h-11 rounded-lg bg-zola-blue text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="button" onClick={onContinueToReset} disabled={!code.trim()}>
                Tiếp tục
              </button>
              <button className="text-sm text-zola-blue hover:underline" type="button" onClick={() => { setStep("email"); setCode(""); setMessage(""); }}>
                ← Nhập lại email
              </button>
            </>
          )}

          {/* Step 3: New password */}
          {step === "reset" && (
            <>
              <p className="text-sm text-slate-600 text-center">Tạo mật khẩu mới cho tài khoản <strong>{email}</strong></p>
              <label className="h-12 border-b border-slate-200 flex items-center">
                <input className="w-full border-none outline-none text-sm" type="password" placeholder="Mật khẩu mới (tối thiểu 8 ký tự)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
              </label>
              <label className="h-12 border-b border-slate-200 flex items-center">
                <input className="w-full border-none outline-none text-sm" type="password" placeholder="Xác nhận mật khẩu mới" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newPassword && confirmPassword) void onResetPassword(); }} />
              </label>
              <button className="h-11 rounded-lg bg-zola-blue text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="button" onClick={() => void onResetPassword()} disabled={loading || !newPassword || !confirmPassword || newPassword.length < 8}>
                {loading ? "Đang lưu..." : "Đặt mật khẩu mới"}
              </button>
              <button className="text-sm text-zola-blue hover:underline" type="button" onClick={() => { setStep("otp"); setMessage(""); }}>
                ← Nhập lại OTP
              </button>
            </>
          )}

          {message && <p className="m-0 p-3 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-sm">{message}</p>}

          <div className="flex justify-center text-sm">
            <Link className="text-zola-blue hover:text-blue-700" to="/login">{t("backToLogin")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
