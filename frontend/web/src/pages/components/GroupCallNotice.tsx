type GroupCallNoticeProps = {
  language: "vi" | "en";
  description: string;
  onJoin: () => void;
};

export function GroupCallNotice({ language, description, onJoin }: GroupCallNoticeProps) {
  return (
    <div className="z-20 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-emerald-100">{description}</div>
        <button
          type="button"
          onClick={onJoin}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400"
        >
          {language === "vi" ? "Tham gia cuoc goi" : "Join call"}
        </button>
      </div>
    </div>
  );
}
