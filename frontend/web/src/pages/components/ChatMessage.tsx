import { CheckCheck, Pin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageActions } from "./MessageActions";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage, ChatMessageProps } from "./ChatMessage.types";
import { resolveMediaUrl } from "../utils/mediaUrl";

export type { ChatMessage, ChatMessageProps };

function ReadMark({ status }: { status: ChatMessage["status"] }) {
  if (status === "uploading") {
    return <span>uploading...</span>;
  }

  if (status === "upload_failed") {
    return <span className="text-rose-500">upload failed</span>;
  }

  if (status === "sending") {
    return <span>...</span>;
  }

  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <CheckCheck size={12} className="text-sky-400" />
        <span className="capitalize">delivered</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <CheckCheck size={12} className={status === "seen" ? "text-emerald-400" : "text-slate-400"} />
      <span className="capitalize">{status}</span>
    </span>
  );
}

function summarizeReactions(reactions: string[] | undefined) {
  const buckets = new Map<string, number>();
  for (const reaction of reactions ?? []) {
    const parts = reaction.split("|");
    const emoji = (parts[1] ?? parts[0] ?? "").trim();
    if (!emoji) {
      continue;
    }
    buckets.set(emoji, (buckets.get(emoji) ?? 0) + 1);
  }
  return Array.from(buckets.entries());
}

export function ChatMessageRow({
  message,
  isMine,
  language,
  selectionModeActive = false,
  isSelected = false,
  recipientAvatar,
  senderName,
  senderAvatarUrl,
  showSenderName = false,
  showAvatar = true,
  showMeta = true,
  menuPlacement = "above",
  onSenderClick,
  onSelectionMouseDown,
  onSelectionMouseEnter,
  onDelete,
  onReply,
  onEdit,
  onForward,
  onRecall,
  onReact,
  onPin,
  onUnpin,
  canPin = true,
  onVotePoll,
  onClosePoll,
  onCompleteSchedule,
}: ChatMessageProps) {
  const [isMenuPinned, setIsMenuPinned] = useState(false);
  const [isLongPressOpen, setIsLongPressOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onOutside = (event: MouseEvent | TouchEvent) => {
      if (!rowRef.current) {
        return;
      }
      if (!rowRef.current.contains(event.target as Node)) {
        setIsMenuPinned(false);
        setIsLongPressOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);

    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, []);

  const showMenu = useMemo(
    () => !selectionModeActive && (isMenuPinned || isLongPressOpen),
    [isLongPressOpen, isMenuPinned, selectionModeActive],
  );
  const reactionSummary = useMemo(() => summarizeReactions(message.reactions), [message.reactions]);
  const resolvedSenderAvatarUrl = resolveMediaUrl(senderAvatarUrl ?? null);

  const startLongPress = () => {
    if (selectionModeActive) {
      return;
    }
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setIsLongPressOpen(true);
      setIsMenuPinned(true);
    }, 380);
  };

  const endLongPress = () => {
    if (!longPressTimerRef.current) {
      return;
    }
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  return (
    <div className={`group flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        ref={rowRef}
        className={`relative flex max-w-full items-end gap-2 rounded-xl px-1 py-1 transition-colors duration-150 ${showMenu ? "bg-slate-800/45" : "bg-transparent"}`}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        onTouchCancel={endLongPress}
        onContextMenu={(event) => {
          if (selectionModeActive) {
            return;
          }
          event.preventDefault();
          setIsMenuPinned(true);
        }}
      >
        {!isMine && showAvatar && (
          resolvedSenderAvatarUrl ? (
            <button
              type="button"
              onClick={() => onSenderClick?.(message.senderId)}
              className="shrink-0 rounded-full"
            >
              <img
                src={resolvedSenderAvatarUrl}
                alt={senderName ?? recipientAvatar ?? "User"}
                className="h-9 w-9 rounded-full object-cover object-center ring-1 ring-slate-300/25"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSenderClick?.(message.senderId)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-100"
            >
              {recipientAvatar ?? "U"}
            </button>
          )
        )}

        {!isMine && !showAvatar && <div className="w-9 shrink-0" />}

        <div className={`relative flex flex-col ${isMine ? "items-end" : "items-start"}`}>
          <div className={`pointer-events-none absolute top-0 h-full w-56 ${isMine ? "-left-56" : "-right-56"}`} />

          {!isMine && showSenderName && (
            <button
              type="button"
              onClick={() => onSenderClick?.(message.senderId)}
              className="mb-1 px-1 text-[11px] font-semibold text-slate-300 transition hover:text-sky-300"
            >
              {senderName ?? (language === "vi" ? "Thanh vien" : "Member")}
            </button>
          )}

          <MessageActions
            message={message}
            language={language}
            isMine={isMine}
            placement={menuPlacement}
            visible={showMenu}
            onDelete={onDelete}
            onReply={onReply}
            onEdit={onEdit}
            onForward={onForward}
            onRecall={onRecall}
            onReact={onReact}
            onPin={onPin}
            onUnpin={onUnpin}
            canPin={canPin}
            onToggleMore={() => setIsMenuPinned((prev) => !prev)}
          />

          <div
            data-message-bubble="true"
            onMouseDown={onSelectionMouseDown}
            onMouseEnter={onSelectionMouseEnter}
            className={`relative rounded-[1.35rem] transition-all duration-150 ${isSelected ? "ring-2 ring-sky-300/75 shadow-[0_0_0_1px_rgba(125,211,252,0.16)]" : ""}`}
          >
            {isSelected && (
              <div
                className={`pointer-events-none absolute -top-2 z-10 inline-flex items-center rounded-full border border-sky-300/45 bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-100 ${isMine ? "right-2" : "left-2"}`}
              >
                {language === "vi" ? "Da chon" : "Selected"}
              </div>
            )}
            {message.isPinned && !message.isRecalled && (
              <div
                className={`pointer-events-none absolute -top-2 z-10 inline-flex items-center gap-1 rounded-full border border-amber-300/45 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ${isMine ? "left-2" : "right-2"}`}
              >
                <Pin size={10} />
                <span>{language === "vi" ? "Ghim" : "Pinned"}</span>
              </div>
            )}

            <MessageBubble
              message={message}
              isMine={isMine}
              onVotePoll={(optionId) => onVotePoll?.(message, optionId)}
              onClosePoll={() => onClosePoll?.(message)}
              onCompleteSchedule={() => onCompleteSchedule?.(message)}
            />
          </div>

          {reactionSummary.length > 0 && (
            <div className={`mt-1 flex flex-wrap gap-1 px-1 ${isMine ? "justify-end" : "justify-start"}`}>
              {reactionSummary.map(([emoji, count]) => (
                <span
                  key={`${message.id}-${emoji}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 shadow-sm"
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </span>
              ))}
            </div>
          )}

          {showMeta && (
            <div className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-slate-400 ${isMine ? "justify-end" : "justify-start"}`}>
              <span>{message.timestamp}</span>
              {isMine && <ReadMark status={message.status} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
