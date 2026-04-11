import { Link } from "react-router-dom";
import { useState } from "react";
import { requestForgotOtp, toErrorMessage, verifyForgotOtp } from "../api/authApi";
import { useLanguage } from "../i18n/language";

export function ForgotPasswordPage() {
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onRequestOtp = async () => {
    try {
      setLoading(true);
      const result = await requestForgotOtp(email.trim());
      setMessage(result.message || t("otpSent"));
    } catch (error) {
      setMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    try {
      setLoading(true);
      const result = await verifyForgotOtp(email.trim(), code.trim());
      setMessage(result.data.message);
    } catch (error) {
      setMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 md:py-12 bg-zalo-sky flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <button type="button" className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "vi" ? "border-blue-400 text-zalo-blue bg-white" : "border-slate-300 text-slate-600 bg-white"}`} onClick={() => setLanguage("vi")}>
          Tieng Viet
        </button>
        <button type="button" className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "en" ? "border-blue-400 text-zalo-blue bg-white" : "border-slate-300 text-slate-600 bg-white"}`} onClick={() => setLanguage("en")}>
          English
        </button>
      </div>

      <div className="text-zalo-blue text-6xl font-bold leading-none tracking-tight">{t("appName")}</div>
      <p className="text-center text-slate-600">{t("forgotSub")}</p>

      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
        <header className="px-6 py-4 border-b border-slate-200 text-center text-2xl font-semibold text-slate-900">{t("forgotTitle")}</header>

        <div className="p-6 grid gap-4">
          <label className="h-12 border-b border-slate-200 flex items-center">
            <input className="w-full border-none outline-none text-sm" type="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <button className="h-11 rounded-lg bg-zalo-blue text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="button" onClick={() => void onRequestOtp()} disabled={loading || !email.trim()}>
            {t("sendOtp")}
          </button>

          <label className="h-12 border-b border-slate-200 flex items-center">
            <input className="w-full border-none outline-none text-sm" type="text" placeholder={t("otpCode")} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>

          <button className="h-11 rounded-lg border border-zalo-blue text-zalo-blue font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="button" onClick={() => void onVerifyOtp()} disabled={loading || !email.trim() || !code.trim()}>
            {t("verifyOtp")}
          </button>

          {message && <p className="m-0 p-3 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-sm">{message}</p>}

          <div className="flex justify-center text-sm">
            <Link className="text-zalo-blue hover:text-blue-700" to="/login">{t("backToLogin")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
