import { Forward, MoreHorizontal, Reply, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./ChatMessage.types";

type MessageActionsProps = {
  message: ChatMessage;
  language: "vi" | "en";
  isMine: boolean;
  placement?: "above" | "below";
  visible: boolean;
  onDelete: (messageId: string) => void | Promise<void>;
  onReply: (message: ChatMessage) => void;
  onEdit?: (messageId: string, currentText: string) => void | Promise<void>;
  onForward?: (messageId: string) => void | Promise<void>;
  onRecall?: (messageId: string) => void | Promise<void>;
  onReact?: (messageId: string, emoji: string) => void | Promise<void>;
  onToggleMore: () => void;
};

const quickReactions = ["👍", "❤️", "😂", "🔥"];

export function MessageActions({
  message,
  language,
  isMine,
  placement = "above",
  visible,
  onDelete,
  onReply,
  onEdit,
  onForward,
  onRecall,
  onReact,
  onToggleMore,
}: MessageActionsProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) {
      setIsMoreOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!moreMenuRef.current) {
        return;
      }
      if (!moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const handleCopy = async () => {
    if (!message.text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(message.text);
    } catch {
      // Ignore clipboard errors in unsupported environments.
    } finally {
      setIsMoreOpen(false);
      onToggleMore();
    }
  };

  const handleRecall = async () => {
    if (!onRecall) {
      return;
    }
    await onRecall(message.id);
    setIsMoreOpen(false);
    onToggleMore();
  };

  const sideClass = isMine ? "right-full mr-2" : "left-full ml-2";
  const isRecalled = Boolean(message.isRecalled);
  const verticalClass = placement === "below" ? "top-1/2 -translate-y-[45%]" : "top-1/2 -translate-y-1/2";
  const visibleClass = visible
    ? "pointer-events-auto opacity-100"
    : "pointer-events-none opacity-0";

  return (
    <div
      className={`absolute z-30 w-52 rounded-xl border border-slate-600 bg-slate-800/95 p-2 shadow-xl backdrop-blur transition-all duration-150 ${sideClass} ${verticalClass} ${visibleClass}`}
    >
      <div className="mb-2 flex gap-1">
        {quickReactions.map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={isRecalled}
            onClick={() => {
              void onReact?.(message.id, emoji);
              onToggleMore();
            }}
            className="rounded-md px-1.5 py-1 text-sm transition-all duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1 text-slate-200">
        <button
          type="button"
          disabled={isRecalled}
          onClick={() => {
            onReply(message);
            onToggleMore();
          }}
          className="inline-flex flex-col items-center justify-center rounded-lg py-1 text-[10px] hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Reply size={14} />
          <span>{language === "vi" ? "Tra loi" : "Reply"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            void onForward?.(message.id);
            onToggleMore();
          }}
          className="inline-flex flex-col items-center justify-center rounded-lg py-1 text-[10px] hover:bg-slate-700"
        >
          <Forward size={14} />
          <span>{language === "vi" ? "Chuyen" : "Forward"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            void onDelete(message.id);
            onToggleMore();
          }}
          className="inline-flex flex-col items-center justify-center rounded-lg py-1 text-[10px] text-rose-300 hover:bg-rose-500/20"
        >
          <Trash2 size={14} />
          <span>{language === "vi" ? "Xoa" : "Delete"}</span>
        </button>
        <div ref={moreMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsMoreOpen((prev) => !prev);
            }}
            className="inline-flex w-full flex-col items-center justify-center rounded-lg py-1 text-[10px] hover:bg-slate-700"
          >
            <MoreHorizontal size={14} />
            <span>More</span>
          </button>

          {isMoreOpen && (
            <div className="absolute bottom-full right-0 z-40 mb-1 w-28 rounded-lg border border-slate-600 bg-slate-800 p-1 text-xs shadow-lg">
              <button
                type="button"
                onClick={() => {
                  void handleCopy();
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-slate-100 hover:bg-slate-700"
              >
                {language === "vi" ? "Sao chep" : "Copy"}
              </button>
              {isMine && onEdit && !isRecalled && (
                <button
                  type="button"
                  onClick={() => {
                    void onEdit(message.id, message.text);
                    setIsMoreOpen(false);
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sky-300 hover:bg-sky-500/15"
                >
                  {language === "vi" ? "Chinh sua" : "Edit"}
                </button>
              )}
              {isMine && onRecall && !isRecalled && (
                <button
                  type="button"
                  onClick={() => {
                    void handleRecall();
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-amber-300 hover:bg-amber-500/15"
                >
                  {language === "vi" ? "Thu hoi" : "Recall"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
