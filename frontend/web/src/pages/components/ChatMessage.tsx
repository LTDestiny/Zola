import { CheckCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageActions } from "./MessageActions";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage, ChatMessageProps } from "./ChatMessage.types";

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
  recipientAvatar,
  senderName,
  senderAvatarUrl,
  showSenderName = false,
  showAvatar = true,
  showMeta = true,
  menuPlacement = "above",
  onDelete,
  onReply,
  onEdit,
  onForward,
  onRecall,
  onReact,
  onPin,
  onUnpin,
  onVotePoll,
  onClosePoll,
  onCompleteSchedule,
}: ChatMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuPinned, setIsMenuPinned] = useState(false);
  const [isLongPressOpen, setIsLongPressOpen] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover)");
    setCanHover(media.matches);

    const listener = (event: MediaQueryListEvent) => setCanHover(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const onOutside = (event: MouseEvent | TouchEvent) => {
      if (!rowRef.current) {
        return;
      }
      if (!rowRef.current.contains(event.target as Node)) {
        setIsMenuPinned(false);
        setIsLongPressOpen(false);
        setIsHovered(false);
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
    () => isMenuPinned || isLongPressOpen,
    [isLongPressOpen, isMenuPinned],
  );
  const showActionTrigger = useMemo(() => {
    if (!canHover) {
      return true;
    }
    return isHovered || showMenu;
  }, [canHover, isHovered, showMenu]);
  const reactionSummary = useMemo(() => summarizeReactions(message.reactions), [message.reactions]);

  const startLongPress = () => {
    if (canHover) {
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
    <div
      className={`group flex w-full ${isMine ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => canHover && setIsHovered(true)}
      onMouseLeave={() => canHover && !isMenuPinned && setIsHovered(false)}
    >
      <div
        ref={rowRef}
        className={`relative flex max-w-full items-end gap-2 rounded-xl px-1 py-1 transition-colors duration-150 ${showMenu ? "bg-slate-800/45" : "bg-transparent"}`}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        onTouchCancel={endLongPress}
        onContextMenu={(event) => {
          event.preventDefault();
          setIsMenuPinned(true);
        }}
      >
        {!isMine && showAvatar && (
          senderAvatarUrl ? (
            <img
              src={senderAvatarUrl}
              alt={senderName ?? recipientAvatar ?? "User"}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-100">
              {recipientAvatar ?? "U"}
            </div>
          )
        )}

        {!isMine && !showAvatar && <div className="w-8 shrink-0" />}

        <div className={`relative flex flex-col ${isMine ? "items-end" : "items-start"}`}>
          <div className={`pointer-events-none absolute top-0 h-full w-56 ${isMine ? "-left-56" : "-right-56"}`} />

          {!isMine && showSenderName && (
            <p className="mb-1 px-1 text-[11px] font-semibold text-slate-300">
              {senderName ?? (language === "vi" ? "Thanh vien" : "Member")}
            </p>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsMenuPinned((prev) => {
                const next = !prev;
                if (!next) {
                  setIsHovered(false);
                }
                return next;
              });
              setIsLongPressOpen(false);
            }}
            aria-label={language === "vi" ? "Mo tac vu tin nhan" : "Open message actions"}
            title={language === "vi" ? "Tac vu" : "Actions"}
            className={`absolute top-1/2 z-40 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-indigo-300 bg-white text-[12px] font-extrabold text-indigo-700 shadow-sm transition-all duration-150 ${isMine ? "-left-8" : "-right-8"} ${showActionTrigger ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          >
            !
          </button>

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
            onToggleMore={() => setIsMenuPinned((prev) => !prev)}
          />

          <MessageBubble
            message={message}
            isMine={isMine}
            onVotePoll={(optionId) => onVotePoll?.(message, optionId)}
            onClosePoll={() => onClosePoll?.(message)}
            onCompleteSchedule={() => onCompleteSchedule?.(message)}
          />

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
