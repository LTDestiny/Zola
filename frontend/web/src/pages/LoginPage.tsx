import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { loginWithEmailPassword, toErrorMessage } from "../api/authApi";
import { saveAuthTokens } from "../auth/token";
import { useLanguage } from "../i18n/language";

export function LoginPage() {
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const forcedLogoutMessage = sessionStorage.getItem(
      "zola_forced_logout_message",
    );
    if (!forcedLogoutMessage) {
      return;
    }
    setMessage(forcedLogoutMessage);
    sessionStorage.removeItem("zola_forced_logout_message");
  }, []);

  const onLogin = async () => {
    try {
      setLoading(true);
      const result = await loginWithEmailPassword({
        email: email.trim(),
        password,
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
    <main className="min-h-screen px-4 py-8 md:py-12 bg-zola-sky flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "vi"
            ? "border-blue-400 text-zola-blue bg-white"
            : "border-slate-300 text-slate-600 bg-white"
            }`}
          onClick={() => setLanguage("vi")}
        >
          Tieng Viet
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${language === "en"
            ? "border-blue-400 text-zola-blue bg-white"
            : "border-slate-300 text-slate-600 bg-white"
            }`}
          onClick={() => setLanguage("en")}
        >
          English
        </button>
      </div>

      <div className="text-zola-blue text-6xl font-bold leading-none tracking-tight">
        {t("appName")}
      </div>
      <p className="text-center text-slate-600 max-w-md">
        {t("loginPasswordSub")}
      </p>

      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
        <header className="px-6 py-4 border-b border-slate-200 text-center text-2xl font-semibold text-slate-900">
          {t("loginTitle")}
        </header>

        <div className="p-6 grid gap-4">
          <label className="h-12 border-b border-slate-200 flex items-center">
            <input
              type="email"
              placeholder={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-none outline-none text-sm"
            />
          </label>

          <label className="h-12 border-b border-slate-200 flex items-center">
            <input
              type="password"
              placeholder={t("password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-none outline-none text-sm"
            />
          </label>

          <button
            className="h-11 rounded-lg bg-zola-blue text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            onClick={() => void onLogin()}
            disabled={loading || !email.trim() || !password.trim()}
          >
            {t("loginButton")}
          </button>

          {message && (
            <p className="m-0 p-3 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-sm">
              {message}
            </p>
          )}

          <Link
            to="/forgot-password"
            className="text-center text-sm text-slate-600 hover:text-zola-blue"
          >
            {t("forgotPassword")}
          </Link>

          <Link
            to="/register"
            className="text-center text-base font-semibold text-zola-blue hover:text-blue-700"
          >
            {t("register")}
          </Link>
        </div>

        <div className="m-3 md:m-4 p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <strong className="block text-sm text-slate-900">
              Nang cao hieu qua cong viec voi Zola PC
            </strong>
            <p className="mt-1 text-sm text-slate-600">
              Gui file lon len den 1 GB, chup man hinh, goi video va nhieu tien
              ich hon nua
            </p>
          </div>
          <Link
            to="/"
            className="h-10 px-5 w-40 rounded-lg bg-zola-blue text-white inline-flex items-center justify-center font-semibold hover:bg-blue-700 transition-colors"
          >
            Tai ngay
          </Link>
        </div>
      </section>

      <Link to="/chat" className="text-sm text-zola-blue hover:text-blue-700">
        Mobile/Chat View
      </Link>
    </main>
  );
}
