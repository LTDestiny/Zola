import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/language";

export function PolicyPage() {
  const { t, language, setLanguage } = useLanguage();

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

      <section className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-card p-6 md:p-8">
        <h1 className="m-0 text-2xl md:text-3xl font-bold text-slate-900">{t("policyTitle")}</h1>
        <p className="mt-4 text-slate-700 leading-7">{t("policyBody")}</p>
        <p className="mt-3 text-slate-700 leading-7">{t("policyBody")}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link to="/register" className="h-11 px-6 rounded-lg bg-zalo-blue text-white inline-flex items-center justify-center font-semibold hover:bg-blue-700 transition-colors">
            {t("register")}
          </Link>
          <Link to="/login" className="h-11 px-6 rounded-lg border border-zalo-blue text-zalo-blue inline-flex items-center justify-center font-semibold hover:bg-blue-50 transition-colors">
            {t("backToLogin")}
          </Link>
        </div>
      </section>
    </main>
  );
}
