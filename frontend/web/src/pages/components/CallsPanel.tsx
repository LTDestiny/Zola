export interface CallsPanelProps {
  language: "vi" | "en";
}

export function CallsPanel({ language }: CallsPanelProps) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          {language === "vi" ? "Cuoc goi" : "Calls"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {language === "vi"
            ? "Muc calls se duoc mo rong o buoc tiep theo."
            : "Calls section will be expanded in the next step."}
        </p>
      </div>
    </div>
  );
}
