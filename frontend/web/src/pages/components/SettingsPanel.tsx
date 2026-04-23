import { LogOut } from "lucide-react";
import { clearAuthTokens } from "../../auth/token";

export interface SettingsPanelProps {
  language: "vi" | "en";
  onLogout: () => void;
}

export function SettingsPanel({ language, onLogout }: SettingsPanelProps) {
  return (
    <div className="p-4 md:p-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">
          {language === "vi" ? "Cai dat" : "Settings"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {language === "vi"
            ? "Tuy chinh tai khoan va ung dung"
            : "Customize account and app preferences"}
        </p>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50"
        >
          <LogOut size={16} />
          <span>{language === "vi" ? "Dang xuat" : "Logout"}</span>
        </button>
      </div>
    </div>
  );
}
