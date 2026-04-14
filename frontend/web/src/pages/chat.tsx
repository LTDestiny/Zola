import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FileText, Heart, ImagePlus, Info, Paperclip, Phone, SendHorizontal, Smile, Sparkles, Sticker, Video, X } from "lucide-react";
import { type ConversationItem, type MessageItem, type UserProfile } from "../api/chatApi";
import { MessageRenderer, type ChatMessage } from "./components/MessageRenderer";
import {
  Heart,
  ImagePlus,
  Info,
  Phone,
  SendHorizontal,
  Smile,
  Sparkles,
  Sticker,
  Video,
} from "lucide-react";
import {
  type ConversationItem,
  type MessageItem,
  type UserProfile,
} from "../api/chatApi";
import {
  MessageRenderer,
  type ChatMessage,
} from "./components/MessageRenderer";

const currentUserIdFallback = "me";
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const RECALL_WINDOW_MS = 24 * 60 * 60 * 1000;

type ChatProps = {
  language: "vi" | "en";
  activeConversation: ConversationItem | null;
  activeConversationOnline: boolean;
  activeConversationPresenceLabel: string;
  messages: MessageItem[];
  myProfile: UserProfile | null;
  isLoadingMessages: boolean;
  draftMessage: string;
  onDraftChange: (value: string) => void;
  onSendMessage: () => Promise<void>;
  onSendFiles: (files: File[], caption: string) => Promise<void>;
  onEditMessage: (messageId: string, nextContent: string) => void | Promise<void>;
  onRecallMessage: (messageId: string) => void | Promise<void>;
  onDeleteForMe: (messageId: string) => void | Promise<void>;
  onForwardMessage: (messageId: string) => void | Promise<void>;
  onReactMessage: (messageId: string, emoji: string) => void | Promise<void>;
  pendingUploads: Array<{
    localId: string;
    fileName: string;
    fileSizeLabel: string;
    mediaKind: "image" | "video" | "file";
    status: "uploading" | "failed";
    progress: number;
    errorMessage?: string;
  }>;
  onRetryUpload: (localId: string) => void | Promise<void>;
  onCancelUpload: (localId: string) => void;
  isSending: boolean;
  typingText: string | null;
  hasMoreMessages: boolean;
  isLoadingMoreMessages: boolean;
  onLoadOlderMessages: () => void | Promise<void>;
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
  if (Number.isNaN(date.getTime()))
    return language === "vi" ? "Khong ro" : "N/A";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function toStatus(item: MessageItem, myId: string | undefined): ChatMessage["status"] {
  if (item.senderId !== myId) {
    return "sent";
  }

  const seenCount = item.seenBy?.length ?? 0;
  if (seenCount > 1) {
    return "seen";
  }

  const deliveredCount = item.deliveredTo?.length ?? 0;
  if (deliveredCount > 1) {
    return "delivered";
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

function mapToUiMessage(
  item: MessageItem,
  language: "vi" | "en",
  myId?: string,
): ChatMessage {
  const rawType = (item.type ?? "TEXT").toUpperCase();
  const isMine = item.senderId === myId;
  const recalledText =
    language === "vi"
      ? isMine
        ? "Ban da thu hoi mot tin nhan"
        : "Tin nhan da duoc thu hoi"
      : isMine
        ? "You recalled a message"
        : "This message was recalled";

  return {
    id: item.id,
    senderId: item.senderId,
    text: item.recalled ? recalledText : item.content,
    isRecalled: Boolean(item.recalled),
    timestamp: formatTime(item.createdAt, language),
    status: toStatus(item, myId),
    type: inferMessageType(item),
    rawType,
    isForwarded: rawType === "FORWARD",
    isEdited: Boolean(item.edited),
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
  activeConversationOnline,
  activeConversationPresenceLabel,
  messages,
  myProfile,
  isLoadingMessages,
  draftMessage,
  onDraftChange,
  onSendMessage,
  onSendFiles,
  onEditMessage,
  onRecallMessage,
  onDeleteForMe,
  onForwardMessage,
  onReactMessage,
  pendingUploads,
  onRetryUpload,
  onCancelUpload,
  isSending,
  typingText,
  hasMoreMessages,
  isLoadingMoreMessages,
  onLoadOlderMessages,
}: ChatProps) {
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isDragOverComposer, setIsDragOverComposer] = useState(false);
  const [mediaCaption, setMediaCaption] = useState("");
  const [previewFiles, setPreviewFiles] = useState<Array<{ id: string; file: File; previewUrl?: string; mediaKind: "image" | "video" | "file" }>>([]);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    originalText: string;
  } | null>(null);
  const [policyModalMessage, setPolicyModalMessage] = useState<string | null>(
    null,
  );
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const fileInputId = useId();
  const imageInputId = `${fileInputId}-image`;
  const videoInputId = `${fileInputId}-video`;
  const mobileCameraInputId = `${fileInputId}-camera`;
  const messageBottomRef = useRef<HTMLDivElement | null>(null);

  const quickEmojis = ["😀", "😂", "😍", "👍", "🔥", "🙏", "🎉", "💬"];

  const currentUserId = myProfile?.id ?? currentUserIdFallback;

  const mappedFromServer = useMemo(() => {
    return messages.map((item) =>
      mapToUiMessage(item, language, currentUserId),
    );
  }, [messages, language, currentUserId]);

  useEffect(() => {
    setLocalMessages(mappedFromServer);
  }, [mappedFromServer]);

  useEffect(() => {
    if (!editingMessage) {
      return;
    }

    const exists = messages.some((item) => item.id === editingMessage.id);
    if (!exists) {
      setEditingMessage(null);
      onDraftChange("");
    }
  }, [editingMessage, messages, onDraftChange]);

  useEffect(() => {
    setIsTyping(Boolean(typingText));
  }, [typingText]);

  useEffect(() => {
    messageBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  useEffect(() => {
    return () => {
      previewFiles.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [previewFiles]);

  const inferFileKind = (file: File): "image" | "video" | "file" => {
    if (file.type.startsWith("image/")) {
      return "image";
    }
    if (file.type.startsWith("video/")) {
      return "video";
    }
    return "file";
  };

  const queuePreviewFiles = (files: File[]) => {
    const mapped = files.map((file, index) => {
      const mediaKind = inferFileKind(file);
      const previewUrl = mediaKind === "file" ? undefined : URL.createObjectURL(file);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        mediaKind,
        previewUrl,
      };
    });
    setPreviewFiles((prev) => [...prev, ...mapped]);
    setShowAttachMenu(false);
  };

  const clearPreviewFiles = () => {
    setPreviewFiles((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return [];
    });
    setMediaCaption("");
  };

  const handleConfirmSendPreview = async () => {
    const files = previewFiles.map((item) => item.file);
    if (files.length === 0) {
      return;
    }
    await onSendFiles(files, mediaCaption.trim());
    clearPreviewFiles();
  };

  const removePreviewFile = (fileId: string) => {
    setPreviewFiles((prev) => {
      const target = prev.find((item) => item.id === fileId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== fileId);
    });
  };

  const isMessageActionExpired = (messageId: string, windowMs: number) => {
    const source = messages.find((item) => item.id === messageId);
    if (!source?.createdAt) {
      return false;
    }

    const createdAtMs = Date.parse(source.createdAt);
    if (Number.isNaN(createdAtMs)) {
      return false;
    }

    return Date.now() - createdAtMs > windowMs;
  };

  const handleSendMessage = async () => {
    const text = draftMessage.trim();
    if (!text) {
      return;
    }

    if (editingMessage) {
      if (isMessageActionExpired(editingMessage.id, EDIT_WINDOW_MS)) {
        setPolicyModalMessage(
          language === "vi"
            ? "Khong the sua tin nhan vi qua 15p"
            : "Cannot edit this message after 15 minutes",
        );
        setEditingMessage(null);
        onDraftChange("");
        return;
      }

      await onEditMessage(editingMessage.id, text);
      setEditingMessage(null);
      onDraftChange("");
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

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
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

          <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900">
            Welcome back!
          </h2>
          <p className="mx-auto mb-10 max-w-md text-lg leading-relaxed text-slate-600">
            {language === "vi"
              ? "Khong tu dong mo hoi thoai. Chon mot nguoi ben trai de bat dau nhan tin."
              : "No auto-open conversation. Select someone on the left to start messaging."}
          </p>

          <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
            <article className="rounded-2xl bg-[#f5f2ff] p-6">
              <h4 className="mb-1 text-sm font-bold">AI Summaries</h4>
              <p className="text-xs text-slate-600">
                Get quick recaps of long threads instantly.
              </p>
            </article>
            <article className="rounded-2xl bg-[#f5f2ff] p-6">
              <h4 className="mb-1 text-sm font-bold">Editorial Drafts</h4>
              <p className="text-xs text-slate-600">
                Switch seamlessly between chat and drafting mode.
              </p>
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
            <span
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${activeConversationOnline ? "bg-emerald-500" : "bg-slate-400"}`}
            />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {activeConversation.name}
            </h3>
            <p
              className={`text-xs ${activeConversationOnline ? "text-emerald-600" : "text-slate-500"}`}
            >
              {activeConversationPresenceLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-500">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-100 hover:text-slate-800"
          >
            <Phone size={18} />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-100 hover:text-slate-800"
          >
            <Video size={18} />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-100 hover:text-slate-800"
          >
            <Info size={18} />
          </button>
        </div>
      </header>

      {/* ... phần Header ... */}

      <div
        className={`scrollbar-hide relative flex-1 overflow-y-auto bg-slate-50/30 px-4 py-6 ${isDragOverComposer ? "ring-2 ring-indigo-300 ring-inset" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (event.dataTransfer.items.length > 0) {
            setIsDragOverComposer(true);
          }
        }}
        onDragLeave={() => setIsDragOverComposer(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOverComposer(false);
          const files = Array.from(event.dataTransfer.files ?? []);
          if (files.length > 0) {
            queuePreviewFiles(files);
          }
        }}
      >
        {isDragOverComposer && (
          <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/80">
            <p className="text-sm font-semibold text-indigo-700">
              {language === "vi" ? "Tha file de gui" : "Drop files to upload"}
            </p>
          </div>
        )}
        {/* Tăng chiều rộng tối đa của vùng chứa tin nhắn */}
        <div className="mx-auto w-full max-w-full lg:max-w-6xl xl:max-w-7xl">
          {isLoadingMessages ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="flex flex-col">
              {hasMoreMessages && (
                <div className="mb-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      void onLoadOlderMessages();
                    }}
                    disabled={isLoadingMoreMessages}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoadingMoreMessages
                      ? language === "vi"
                        ? "Dang tai..."
                        : "Loading..."
                      : language === "vi"
                        ? "Tai tin nhan cu hon"
                        : "Load older messages"}
                  </button>
                </div>
              )}

              {localMessages.map((message, index) => {
                const isMine = message.senderId === currentUserId;
                const prev = localMessages[index - 1];
                const next = localMessages[index + 1];
                const sameAsPrev = prev?.senderId === message.senderId;
                const sameAsNext = next?.senderId === message.senderId;
                const showAvatar = !isMine && !sameAsNext;
                const showMeta = !sameAsNext;
                return (
                  <div
                    key={message.id}
                    className={sameAsPrev ? "mt-1.5" : "mt-3"}
                  >
                    <MessageRenderer
                      message={{
                        ...message,
                        reactions: messages.find(
                          (item) => item.id === message.id,
                        )?.reactions,
                      }}
                      isMine={isMine}
                      language={language}
                      recipientAvatar={activeConversation.name
                        .slice(0, 2)
                        .toUpperCase()}
                      showAvatar={showAvatar}
                      showMeta={showMeta}
                      menuPlacement={index <= 1 ? "below" : "above"}
                      onDelete={(messageId) => onDeleteForMe(messageId)}
                      onReply={(target) => {
                        onDraftChange(
                          `${language === "vi" ? "Tra loi" : "Reply"}: ${target.text}\n`,
                        );
                      }}
                      onEdit={(messageId, currentText) => {
                        if (isMessageActionExpired(messageId, EDIT_WINDOW_MS)) {
                          setPolicyModalMessage(
                            language === "vi"
                              ? "Khong the sua tin nhan vi qua 15p"
                              : "Cannot edit this message after 15 minutes",
                          );
                          return;
                        }

                        setEditingMessage({
                          id: messageId,
                          originalText: currentText,
                        });
                        onDraftChange(currentText);
                      }}
                      onForward={(messageId) => onForwardMessage(messageId)}
                      onRecall={(messageId) => {
                        if (isMessageActionExpired(messageId, RECALL_WINDOW_MS)) {
                          setPolicyModalMessage(
                            language === "vi"
                              ? "Khong the thu hoi tin nhan sau 24h"
                              : "Cannot recall this message after 24 hours",
                          );
                          return;
                        }

                        return onRecallMessage(messageId);
                      }}
                      onReact={(messageId, emoji) => onReactMessage(messageId, emoji)}
                      onRecall={(messageId) => onRecallMessage(messageId)}
                      onReact={(messageId, emoji) =>
                        onReactMessage(messageId, emoji)
                      }
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
          <div className="mb-2 text-xs text-slate-500">
            {language === "vi" ? "Dang go..." : "Typing..."}
          </div>
        )}

        {pendingUploads.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {pendingUploads.map((item) => (
              <div key={item.localId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">{item.fileName}</p>
                    <p className="text-[11px] text-slate-500">{item.fileSizeLabel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => {
                          void onRetryUpload(item.localId);
                        }}
                        className="rounded-md border border-indigo-200 px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        {language === "vi" ? "Gui lai" : "Retry"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCancelUpload(item.localId)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                    >
                      {language === "vi" ? "Huy" : "Cancel"}
                    </button>
                  </div>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${item.status === "failed" ? "bg-rose-400" : "bg-indigo-500"}`}
                    style={{ width: `${Math.max(2, item.progress)}%` }}
                  />
                </div>
                {item.errorMessage && <p className="mt-1 text-[11px] text-rose-500">{item.errorMessage}</p>}
              </div>
            ))}
          </div>
        )}

        {editingMessage && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-amber-700">
                {language === "vi" ? "Dang chinh sua" : "Editing message"}
              </p>
              <p className="truncate text-xs text-amber-800">
                {editingMessage.originalText}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                onDraftChange("");
              }}
              className="shrink-0 rounded-md border border-amber-300 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-100"
            >
              {language === "vi" ? "Huy" : "Cancel"}
            </button>
          </div>
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
            <button
              type="button"
              onClick={() => setShowAttachMenu((prev) => !prev)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
              title={language === "vi" ? "Dinh kem" : "Attachment"}
              aria-label={language === "vi" ? "Dinh kem" : "Attachment"}
            >
              <Paperclip size={18} />
            </button>
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
              multiple
              disabled={isSending}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/mov,video/webm"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  queuePreviewFiles(files);
                }
                event.currentTarget.value = "";
              }}
            />
            <input
              id={imageInputId}
              type="file"
              className="hidden"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  queuePreviewFiles(files);
                }
                event.currentTarget.value = "";
              }}
            />
            <input
              id={videoInputId}
              type="file"
              className="hidden"
              accept="video/mp4,video/mov,video/webm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  queuePreviewFiles([file]);
                }
                event.currentTarget.value = "";
              }}
            />
            <input
              id={mobileCameraInputId}
              type="file"
              className="hidden"
              accept="image/*,video/*"
              capture="environment"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  queuePreviewFiles(files);
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
            placeholder={
              language === "vi" ? "Nhap tin nhan..." : "Type a message..."
            }
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
            {editingMessage
              ? language === "vi"
                ? "Luu"
                : "Save"
              : language === "vi"
                ? "Gui"
                : "Send"}
          </button>
        </div>

        {showAttachMenu && (
          <div className="absolute bottom-16 left-3 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg sm:left-4">
            <button
              type="button"
              onClick={() => document.getElementById(imageInputId)?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <ImagePlus size={16} />
              <span>{language === "vi" ? "Gui hinh anh" : "Send image"}</span>
            </button>
            <button
              type="button"
              onClick={() => document.getElementById(videoInputId)?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <Video size={16} />
              <span>{language === "vi" ? "Gui video" : "Send video"}</span>
            </button>
            <button
              type="button"
              onClick={() => document.getElementById(fileInputId)?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <FileText size={16} />
              <span>{language === "vi" ? "Gui tep tin" : "Send file"}</span>
            </button>
            <button
              type="button"
              onClick={() => document.getElementById(mobileCameraInputId)?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <ImagePlus size={16} />
              <span>{language === "vi" ? "Chup anh/Quay nhanh" : "Capture photo/video"}</span>
            </button>
          </div>
        )}
      </footer>

      {previewFiles.length > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">
                {language === "vi" ? "Xem truoc truoc khi gui" : "Preview before send"}
              </h3>
              <button
                type="button"
                onClick={clearPreviewFiles}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {previewFiles.map((item) => (
                  <div key={item.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {item.mediaKind === "image" && item.previewUrl && (
                      <img src={item.previewUrl} alt={item.file.name} className="h-32 w-full object-cover" />
                    )}
                    {item.mediaKind === "video" && item.previewUrl && (
                      <video src={item.previewUrl} className="h-32 w-full object-cover" preload="metadata" />
                    )}
                    {item.mediaKind === "file" && (
                      <div className="grid h-32 place-items-center p-3 text-center">
                        <FileText size={18} className="text-indigo-600" />
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.file.name}</p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removePreviewFile(item.id)}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <textarea
                value={mediaCaption}
                onChange={(event) => setMediaCaption(event.target.value)}
                className="mt-3 min-h-20 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
                placeholder={language === "vi" ? "Them chu thich (caption)..." : "Add a caption..."}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={clearPreviewFiles}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                {language === "vi" ? "Huy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmSendPreview();
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {language === "vi" ? "Gui" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {policyModalMessage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">
              {language === "vi" ? "Thong bao" : "Notice"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{policyModalMessage}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPolicyModalMessage(null)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
