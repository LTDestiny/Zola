type UploadLimitModalProps = {
  language: "vi" | "en";
  message: string | null;
  onClose: () => void;
};

export function UploadLimitModal({ language, message, onClose }: UploadLimitModalProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-slate-900/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">
          {language === "vi" ? "Vượt giới hạn dung lượng" : "File size limit exceeded"}
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{message}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
