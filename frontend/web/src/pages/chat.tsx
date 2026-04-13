import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Heart, ImagePlus, Info, Phone, SendHorizontal, Smile, Sparkles, Sticker, Video } from "lucide-react";
import { type ConversationItem, type MessageItem, type UserProfile } from "../api/chatApi";
import { MessageRenderer, type ChatMessage } from "./components/MessageRenderer";

const currentUserIdFallback = "me";

type ChatProps = {
  language: "vi" | "en";
  activeConversation: ConversationItem | null;
  messages: MessageItem[];
  myProfile: UserProfile | null;
  isLoadingMessages: boolean;
  draftMessage: string;
  onDraftChange: (value: string) => void;
  onSendMessage: () => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
  onRecallMessage: (messageId: string) => void | Promise<void>;
  onDeleteForMe: (messageId: string) => void | Promise<void>;
  onForwardMessage: (messageId: string) => void | Promise<void>;
  onReactMessage: (messageId: string, emoji: string) => void | Promise<void>;
  isSending: boolean;
  typingText: string | null;
};

function buildReactionSummary(reactions: string[] | undefined) {
  const buckets = new Map<string, number>();
  for (const value of reactions ?? []) {
    const parts = value.split("|");
    const emoji = parts[1] ?? parts[0] ?? "";
    if (!emoji) continue;
    buckets.set(emoji, (buckets.get(emoji) ?? 0) + 1);
  }
  return Array.from(buckets.entries());
}

function formatTime(value: string | null, language: "vi" | "en") {
  if (!value) return language === "vi" ? "Khong ro" : "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === "vi" ? "Khong ro" : "N/A";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function toStatus(item: MessageItem, myId: string | undefined): ChatMessage["status"] {
  const seenCount = item.seenBy?.length ?? 0;
  if (item.senderId === myId && seenCount > 1) {
    return "seen";
  }
  return "sent";
}

function inferMessageType(item: MessageItem): ChatMessage["type"] {
  const rawType = (item.type ?? "TEXT").toUpperCase();
  if (rawType === "IMAGE") return "image";
  if (rawType === "VIDEO") return "video";
  if (rawType === "AUDIO") return "audio";
  if (rawType === "FILE") {
    const fileName = (item.fileName ?? "").toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(fileName)) return "image";
    if (/\.(mp4|webm|mov|mkv)$/.test(fileName)) return "video";
    if (/\.(mp3|wav|ogg|m4a|aac)$/.test(fileName)) return "audio";
    return "file";
  }
  return "text";
}

function mapToUiMessage(item: MessageItem, language: "vi" | "en", myId?: string): ChatMessage {
  const rawType = (item.type ?? "TEXT").toUpperCase();
  return {
    id: item.id,
    senderId: item.senderId,
    text: item.content,
    timestamp: formatTime(item.createdAt, language),
    status: toStatus(item, myId),
    type: inferMessageType(item),
    rawType,
    isForwarded: rawType === "FORWARD",
    mediaUrl: item.fileUrl ?? undefined,
    fileName: item.fileName ?? undefined,
    fileSize: undefined,
    duration: undefined,
    reactions: item.reactions,
  };
}

export function Chat({
  language,
  activeConversation,
  messages,
  myProfile,
  isLoadingMessages,
  draftMessage,
  onDraftChange,
  onSendMessage,
  onSendFile,
  onRecallMessage,
  onDeleteForMe,
  onForwardMessage,
  onReactMessage,
  isSending,
  typingText,
}: ChatProps) {
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const fileInputId = useId();
  const messageBottomRef = useRef<HTMLDivElement | null>(null);

  const quickEmojis = ["😀", "😂", "😍", "👍", "🔥", "🙏", "🎉", "💬"];

  const currentUserId = myProfile?.id ?? currentUserIdFallback;

  const mappedFromServer = useMemo(() => {
    return messages.map((item) => mapToUiMessage(item, language, currentUserId));
  }, [messages, language, currentUserId]);

  useEffect(() => {
    setLocalMessages(mappedFromServer);
  }, [mappedFromServer]);

  useEffect(() => {
    setIsTyping(Boolean(typingText));
  }, [typingText]);

  useEffect(() => {
    messageBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSendMessage = async () => {
    const text = draftMessage.trim();
    if (!text) {
      return;
    }

    const localId = `local-${Date.now()}`;
    const pendingMessage: ChatMessage = {
      id: localId,
      text,
      senderId: currentUserId,
      timestamp: formatTime(new Date().toISOString(), language),
      status: "sending",
      type: "text",
    };

    setLocalMessages((prev) => [...prev, pendingMessage]);

    await onSendMessage();

    setLocalMessages((prev) =>
      prev.map((item) =>
        item.id === localId
          ? {
            ...item,
            status: "sent",
          }
          : item,
      ),
    );
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  if (!activeConversation) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6 text-center sm:p-12">
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-indigo-100 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-violet-100 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="mb-10 inline-block rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="relative mx-auto h-44 w-44">
              <div className="absolute inset-0 scale-110 rounded-full bg-indigo-100" />
              <div className="relative z-10 grid h-full w-full place-items-center rounded-[28px] bg-linear-to-br from-[#2d3358] to-[#59609a] text-5xl text-white">
                <Sparkles size={42} />
              </div>
            </div>
          </div>

          <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900">Welcome back!</h2>
          <p className="mx-auto mb-10 max-w-md text-lg leading-relaxed text-slate-600">
            {language === "vi"
              ? "Khong tu dong mo hoi thoai. Chon mot nguoi ben trai de bat dau nhan tin."
              : "No auto-open conversation. Select someone on the left to start messaging."}
          </p>

          <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
            <article className="rounded-2xl bg-[#f5f2ff] p-6">
              <h4 className="mb-1 text-sm font-bold">AI Summaries</h4>
              <p className="text-xs text-slate-600">Get quick recaps of long threads instantly.</p>
            </article>
            <article className="rounded-2xl bg-[#f5f2ff] p-6">
              <h4 className="mb-1 text-sm font-bold">Editorial Drafts</h4>
              <p className="text-xs text-slate-600">Switch seamlessly between chat and drafting mode.</p>
            </article>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {activeConversation.name.slice(0, 2).toUpperCase()}
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{activeConversation.name}</h3>
            <p className="text-xs text-slate-500">{language === "vi" ? "Dang hoat dong" : "Active now"}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-500">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-100 hover:text-slate-800">
            <Phone size={18} />
          </button>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-100 hover:text-slate-800">
            <Video size={18} />
          </button>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-100 hover:text-slate-800">
            <Info size={18} />
          </button>
        </div>
      </header>

      {/* ... phần Header ... */}

      <div className="scrollbar-hide flex-1 overflow-y-auto bg-slate-50/30 px-4 py-6">
        {/* Tăng chiều rộng tối đa của vùng chứa tin nhắn */}
        <div className="mx-auto w-full max-w-full lg:max-w-6xl xl:max-w-7xl">
          {isLoadingMessages ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="flex flex-col">
              {localMessages.map((message, index) => {
                const isMine = message.senderId === currentUserId;
                const prev = localMessages[index - 1];
                const next = localMessages[index + 1];
                const sameAsPrev = prev?.senderId === message.senderId;
                const sameAsNext = next?.senderId === message.senderId;
                const showAvatar = !isMine && !sameAsNext;
                const showMeta = !sameAsNext;
                return (
                  <div key={message.id} className={sameAsPrev ? "mt-1.5" : "mt-3"}>
                    <MessageRenderer
                      message={{
                        ...message,
                        reactions: messages.find((item) => item.id === message.id)?.reactions,
                      }}
                      isMine={isMine}
                      language={language}
                      recipientAvatar={activeConversation.name.slice(0, 2).toUpperCase()}
                      showAvatar={showAvatar}
                      showMeta={showMeta}
                      menuPlacement={index <= 1 ? "below" : "above"}
                      onDelete={(messageId) => onDeleteForMe(messageId)}
                      onReply={(target) => {
                        onDraftChange(`${language === "vi" ? "Tra loi" : "Reply"}: ${target.text}\n`);
                      }}
                      onForward={(messageId) => onForwardMessage(messageId)}
                      onRecall={(messageId) => onRecallMessage(messageId)}
                      onReact={(messageId, emoji) => onReactMessage(messageId, emoji)}
                    />
                  </div>
                );
              })}
              <div ref={messageBottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* ... phần Footer ... */}

      <footer className="sticky bottom-0 border-t border-slate-200/80 bg-white px-2 py-2 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] sm:px-3">
        {isTyping && (
          <div className="mb-2 text-xs text-slate-500">{language === "vi" ? "Dang go..." : "Typing..."}</div>
        )}

        {showEmojiPanel && (
          <div className="absolute bottom-16 left-3 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:left-4">
            <div className="grid grid-cols-4 gap-2">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-lg px-2 py-1 text-xl hover:bg-slate-100"
                  onClick={() => onDraftChange(`${draftMessage}${emoji}`)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[auto_1fr_auto_auto] items-end gap-1.5">
          <div className="flex items-center gap-1">
            <label
              htmlFor={fileInputId}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
              title={language === "vi" ? "Gui file" : "Upload file"}
              aria-label={language === "vi" ? "Gui file" : "Upload file"}
            >
              <ImagePlus size={18} />
            </label>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
              title={language === "vi" ? "Sticker" : "Sticker"}
            >
              <Sticker size={18} />
            </button>
            <input
              id={fileInputId}
              type="file"
              className="hidden"
              disabled={isSending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onSendFile(file);
                }
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
              onClick={() => setShowEmojiPanel((prev) => !prev)}
              title={language === "vi" ? "Emoji" : "Emoji"}
            >
              <Smile size={18} />
            </button>
          </div>

          <textarea
            className="max-h-24 min-h-9 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
            value={draftMessage}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={language === "vi" ? "Nhap tin nhan..." : "Type a message..."}
            onKeyDown={(event) => {
              void handleKeyDown(event);
            }}
          />

          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-rose-500 hover:bg-rose-50"
            onClick={() => {
              onDraftChange(`${draftMessage} ❤️`);
            }}
            title={language === "vi" ? "Tim" : "Heart"}
          >
            <Heart size={16} />
          </button>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => {
              void handleSendMessage();
            }}
            disabled={isSending || !draftMessage.trim()}
          >
            <SendHorizontal size={16} />
            {language === "vi" ? "Gui" : "Send"}
          </button>
        </div>
      </footer>
    </>
  );
}
