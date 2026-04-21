import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FileText, Heart, ImagePlus, Info, Paperclip, Phone, Pin, SendHorizontal, Smile, Sparkles, Sticker, Video, X } from "lucide-react";
import { type ConversationItem, type MessageItem, type UserProfile } from "../api/chatApi";
import { MessageRenderer, type ChatMessage } from "./components/MessageRenderer";

const currentUserIdFallback = "me";
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const RECALL_WINDOW_MS = 24 * 60 * 60 * 1000;

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type ChatProps = {
  language: "vi" | "en";
  activeConversation: ConversationItem | null;
  activeConversationOnline: boolean;
  activeConversationPresenceLabel: string;
  activeConversationPinned?: boolean;
  headerUnreadBadgeCount?: number;
  userProfileMap?: Record<string, UserProfile>;
  showGroupPanelToggle?: boolean;
  isGroupPanelOpen?: boolean;
  onToggleGroupPanel?: () => void;
  messages: MessageItem[];
  myProfile: UserProfile | null;
  isLoadingMessages: boolean;
  draftMessage: string;
  onDraftChange: (value: string) => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onSendMessage: (options?: { parentMessageId?: string | null }) => Promise<void>;
  onSendFiles: (files: File[], caption: string) => Promise<void>;
  onEditMessage: (messageId: string, nextContent: string) => void | Promise<void>;
  onRecallMessage: (messageId: string) => void | Promise<void>;
  onDeleteForMe: (messageId: string) => void | Promise<void>;
  onForwardMessage: (messageId: string) => void | Promise<void>;
  onReactMessage: (messageId: string, emoji: string) => void | Promise<void>;
  onPinMessage?: (message: ChatMessage) => void | Promise<void>;
  onUnpinMessage?: (message: ChatMessage) => void | Promise<void>;
  onVotePollMessage?: (message: ChatMessage, optionId: string) => void | Promise<void>;
  onClosePollMessage?: (message: ChatMessage) => void | Promise<void>;
  canManageGroupPoll?: boolean;
  pinnedMessages?: Array<{
    id: string;
    sourceMessageId: string;
    itemType: "pin" | "note";
    title: string;
    preview: string;
    createdAtMs: number;
  }>;
  latestPinnedSummary?: {
    itemType: "pin" | "note";
    title: string;
    preview?: string;
    sourceMessageId: string;
    count: number;
  } | null;
  scrollToMessageRequest?: { messageId: string; nonce: number } | null;
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
  onViewportBottomChange?: (atBottom: boolean) => void;
};

type PollCreateEvent = {
  messageId: string;
  pollId: string;
  question: string;
  options: Array<{ id: string; text: string }>;
  multipleChoice: boolean;
  allowChangeVote: boolean;
  hideResultsBeforeVote: boolean;
  expiresAt: string | null;
  createdAtMs: number;
};

type PollVoteEvent = {
  pollId: string;
  senderId: string;
  optionIds: string[];
  createdAtMs: number;
};

type PollCloseEvent = {
  pollId: string;
  senderId: string;
  createdAtMs: number;
};

type PollSummary = NonNullable<ChatMessage["poll"]> & {
  messageId: string;
};

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizePollOptions(raw: unknown) {
  const source = Array.isArray(raw) ? raw : [];
  return source
    .map((item, index) => {
      if (typeof item === "string") {
        const text = item.trim();
        return { id: `opt-${index + 1}`, text };
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const maybe = item as Record<string, unknown>;
      const text = String(maybe.text ?? "").trim();
      const id = String(maybe.id ?? `opt-${index + 1}`).trim();
      if (!text || !id) {
        return null;
      }
      return { id, text };
    })
    .filter((item): item is { id: string; text: string } => Boolean(item));
}

function parsePollCreateEvent(item: MessageItem): PollCreateEvent | null {
  if ((item.type ?? "").toUpperCase() !== "POLL") {
    return null;
  }

  const payload = parseJsonObject(item.content);
  if (!payload) {
    return null;
  }

  const kind = String(payload.kind ?? "").toUpperCase();
  if (kind !== "GROUP_POLL") {
    return null;
  }

  const pollId = String(payload.pollId ?? item.id ?? "").trim();
  const question = String(payload.question ?? payload.title ?? "").trim();
  const options = normalizePollOptions(payload.options);
  if (!pollId || !question || options.length < 2 || !item.id) {
    return null;
  }

  const createdAtMs = Date.parse(String(payload.createdAt ?? item.createdAt ?? ""));
  return {
    messageId: item.id,
    pollId,
    question,
    options,
    multipleChoice: Boolean(payload.multipleChoice),
    allowChangeVote: payload.allowChangeVote !== false,
    hideResultsBeforeVote: Boolean(payload.hideResultsBeforeVote),
    expiresAt: payload.expiresAt ? String(payload.expiresAt) : null,
    createdAtMs: Number.isNaN(createdAtMs) ? 0 : createdAtMs,
  };
}

function parsePollVoteEvent(item: MessageItem): PollVoteEvent | null {
  if ((item.type ?? "").toUpperCase() !== "POLL") {
    return null;
  }

  const payload = parseJsonObject(item.content);
  if (!payload) {
    return null;
  }

  const kind = String(payload.kind ?? "").toUpperCase();
  if (kind !== "POLL_VOTE") {
    return null;
  }

  const pollId = String(payload.pollId ?? "").trim();
  const senderId = String(item.senderId ?? "").trim();
  const rawOptionIds = Array.isArray(payload.optionIds)
    ? payload.optionIds
    : payload.optionIds
      ? [payload.optionIds]
      : [];
  const optionIds = rawOptionIds
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (!pollId || !senderId || optionIds.length === 0) {
    return null;
  }

  const createdAtMs = Date.parse(String(payload.createdAt ?? item.createdAt ?? ""));
  return {
    pollId,
    senderId,
    optionIds,
    createdAtMs: Number.isNaN(createdAtMs) ? 0 : createdAtMs,
  };
}

function parsePollCloseEvent(item: MessageItem): PollCloseEvent | null {
  if ((item.type ?? "").toUpperCase() !== "POLL") {
    return null;
  }

  const payload = parseJsonObject(item.content);
  if (!payload) {
    return null;
  }

  if (String(payload.kind ?? "").toUpperCase() !== "POLL_CLOSE") {
    return null;
  }

  const pollId = String(payload.pollId ?? "").trim();
  const senderId = String(item.senderId ?? "").trim();
  if (!pollId || !senderId) {
    return null;
  }

  const createdAtMs = Date.parse(String(payload.createdAt ?? item.createdAt ?? ""));
  return {
    pollId,
    senderId,
    createdAtMs: Number.isNaN(createdAtMs) ? 0 : createdAtMs,
  };
}

function isPollVoteEventMessage(item: MessageItem) {
  if ((item.type ?? "").toUpperCase() !== "POLL") {
    return false;
  }
  const payload = parseJsonObject(item.content);
  if (!payload) {
    return false;
  }
  const kind = String(payload.kind ?? "").toUpperCase();
  return kind === "POLL_VOTE" || kind === "POLL_CLOSE";
}

function buildPollSummaries(
  messages: MessageItem[],
  myId: string,
  userProfileMap: Record<string, UserProfile>,
) {
  const creations = messages
    .map((item) => parsePollCreateEvent(item))
    .filter((item): item is PollCreateEvent => Boolean(item))
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  const votes = messages
    .map((item) => parsePollVoteEvent(item))
    .filter((item): item is PollVoteEvent => Boolean(item))
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  const closes = messages
    .map((item) => parsePollCloseEvent(item))
    .filter((item): item is PollCloseEvent => Boolean(item))
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  const polls = new Map<string, {
    create: PollCreateEvent;
    votesByUser: Map<string, string[]>;
  }>();

  for (const createEvent of creations) {
    polls.set(createEvent.pollId, {
      create: createEvent,
      votesByUser: new Map<string, string[]>(),
    });
  }

  for (const voteEvent of votes) {
    const target = polls.get(voteEvent.pollId);
    if (!target) {
      continue;
    }

    const validOptionIds = voteEvent.optionIds.filter((optionId) =>
      target.create.options.some((option) => option.id === optionId),
    );
    if (validOptionIds.length === 0) {
      continue;
    }

    const normalizedVote = target.create.multipleChoice
      ? Array.from(new Set(validOptionIds))
      : [validOptionIds[0]];

    const alreadyVoted = target.votesByUser.has(voteEvent.senderId);
    if (alreadyVoted && !target.create.allowChangeVote) {
      continue;
    }

    target.votesByUser.set(voteEvent.senderId, normalizedVote);
  }

  const closeMap = new Map<string, PollCloseEvent>();
  for (const closeEvent of closes) {
    closeMap.set(closeEvent.pollId, closeEvent);
  }

  const byPollId = new Map<string, PollSummary>();
  const byMessageId = new Map<string, PollSummary>();

  polls.forEach((entry, pollId) => {
    const voteCountMap = new Map<string, number>();
    const votersByOption = new Map<string, string[]>();
    entry.create.options.forEach((option) => voteCountMap.set(option.id, 0));
    entry.create.options.forEach((option) => votersByOption.set(option.id, []));

    entry.votesByUser.forEach((selectedIds, voterId) => {
      selectedIds.forEach((optionId) => {
        voteCountMap.set(optionId, (voteCountMap.get(optionId) ?? 0) + 1);
        const current = votersByOption.get(optionId) ?? [];
        votersByOption.set(optionId, [...current, voterId]);
      });
    });

    const totalVotes = entry.votesByUser.size;
    const mySelections = entry.votesByUser.get(myId) ?? [];
    const expiresAt = entry.create.expiresAt;
    const expiresMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const closeEvent = closeMap.get(pollId);
    const closedAtIso = closeEvent
      ? new Date(closeEvent.createdAtMs || Date.now()).toISOString()
      : null;
    const closedBy = closeEvent?.senderId ?? null;
    const isClosedByDeadline = Number.isFinite(expiresMs) ? Date.now() > expiresMs : false;
    const isClosedByAdmin = Boolean(closeEvent);
    const isClosed = isClosedByDeadline || isClosedByAdmin;
    const hasVotedByMe = mySelections.length > 0;
    const hideResultsBeforeVote = entry.create.hideResultsBeforeVote;
    const canViewResults = !hideResultsBeforeVote || hasVotedByMe || isClosed;

    const summary: PollSummary = {
      messageId: entry.create.messageId,
      pollId,
      question: entry.create.question,
      options: entry.create.options.map((option) => {
        const votesForOption = voteCountMap.get(option.id) ?? 0;
        const voterIds = votersByOption.get(option.id) ?? [];
        return {
          id: option.id,
          text: option.text,
          votes: votesForOption,
          percent: canViewResults && totalVotes > 0 ? (votesForOption * 100) / totalVotes : 0,
          selectedByMe: mySelections.includes(option.id),
          voterIds: canViewResults ? voterIds : [],
          voterNames: canViewResults
            ? voterIds.map((voterId) => userProfileMap[voterId]?.fullName ?? `User ${voterId.slice(0, 8)}`)
            : [],
        };
      }),
      totalVotes: canViewResults ? totalVotes : 0,
      hasVotedByMe,
      multipleChoice: entry.create.multipleChoice,
      allowChangeVote: entry.create.allowChangeVote,
      hideResultsBeforeVote,
      canViewResults,
      closedBy,
      closedAt: closedAtIso,
      closesAt: expiresAt,
      expiresAt,
      isClosed,
    };

    byPollId.set(pollId, summary);
    byMessageId.set(entry.create.messageId, summary);
  });

  return { byPollId, byMessageId };
}

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
    if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif|jfif)$/.test(fileName)) return "image";
    if (/\.(mp4|webm|mov|mkv|avi)$/.test(fileName)) return "video";
    if (/\.(mp3|wav|ogg|m4a|aac)$/.test(fileName)) return "audio";
    return "file";
  }
  return "text";
}

function toDisplayNameFromId(
  userId: string,
  language: "vi" | "en",
  myId?: string,
  userProfileMap: Record<string, UserProfile> = {},
) {
  if (myId && userId === myId) {
    return language === "vi" ? "ban" : "you";
  }
  return userProfileMap[userId]?.fullName ?? `User ${userId.slice(0, 8)}`;
}

function formatSystemMessageContent(
  rawContent: string,
  language: "vi" | "en",
  myId?: string,
  userProfileMap: Record<string, UserProfile> = {},
) {
  const content = String(rawContent ?? "").trim();
  if (!content) {
    return language === "vi" ? "Thong bao he thong" : "System notification";
  }

  const prefixed = content.replace(/^\[System\]\s*/i, "").trim();

  const addedMatch = prefixed.match(/^(\S+)\s+added\s+(\S+)\s+to the group$/i);
  if (addedMatch) {
    const actor = toDisplayNameFromId(addedMatch[1], language, myId, userProfileMap);
    const target = toDisplayNameFromId(addedMatch[2], language, myId, userProfileMap);
    return language === "vi"
      ? `${actor} da them ${target} vao nhom`
      : `${actor} added ${target} to the group`;
  }

  const removedMatch = prefixed.match(/^(\S+)\s+removed\s+(\S+)\s+from the group$/i);
  if (removedMatch) {
    const actor = toDisplayNameFromId(removedMatch[1], language, myId, userProfileMap);
    const target = toDisplayNameFromId(removedMatch[2], language, myId, userProfileMap);
    return language === "vi"
      ? `${actor} da xoa ${target} khoi nhom`
      : `${actor} removed ${target} from the group`;
  }

  const joinedMatch = prefixed.match(/^(\S+)\s+joined the group via invite link$/i);
  if (joinedMatch) {
    const actor = toDisplayNameFromId(joinedMatch[1], language, myId, userProfileMap);
    return language === "vi"
      ? `${actor} da tham gia nhom bang link moi`
      : `${actor} joined via invite link`;
  }

  const leftMatch = prefixed.match(/^(\S+)\s+left the group$/i);
  if (leftMatch) {
    const actor = toDisplayNameFromId(leftMatch[1], language, myId, userProfileMap);
    return language === "vi"
      ? `${actor} da roi nhom`
      : `${actor} left the group`;
  }

  return prefixed;
}

function mapToUiMessage(
  item: MessageItem,
  language: "vi" | "en",
  myId?: string,
  userProfileMap: Record<string, UserProfile> = {},
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

  const normalizedText = rawType === "SYSTEM"
    ? formatSystemMessageContent(item.content, language, myId, userProfileMap)
    : item.content;

  return {
    id: item.id,
    senderId: item.senderId,
    text: item.recalled ? recalledText : normalizedText,
    isRecalled: Boolean(item.recalled),
    timestamp: formatTime(item.createdAt, language),
    status: toStatus(item, myId),
    type: inferMessageType(item),
    rawType,
    isForwarded: rawType === "FORWARD",
    isEdited: Boolean(item.edited),
    parentMessageId: item.parentMessageId ?? undefined,
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
  activeConversationPinned = false,
  headerUnreadBadgeCount = 0,
  userProfileMap = {},
  showGroupPanelToggle = false,
  isGroupPanelOpen = true,
  onToggleGroupPanel,
  messages,
  myProfile,
  isLoadingMessages,
  draftMessage,
  onDraftChange,
  onVoiceCall,
  onVideoCall,
  onSendMessage,
  onSendFiles,
  onEditMessage,
  onRecallMessage,
  onDeleteForMe,
  onForwardMessage,
  onReactMessage,
  onPinMessage,
  onUnpinMessage,
  onVotePollMessage,
  onClosePollMessage,
  canManageGroupPoll = false,
  pinnedMessages = [],
  latestPinnedSummary = null,
  scrollToMessageRequest = null,
  pendingUploads,
  onRetryUpload,
  onCancelUpload,
  isSending,
  typingText,
  hasMoreMessages,
  isLoadingMoreMessages,
  onLoadOlderMessages,
  onViewportBottomChange,
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
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [policyModalMessage, setPolicyModalMessage] = useState<string | null>(
    null,
  );
  const [isPinnedListOpen, setIsPinnedListOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const fileInputId = useId();
  const imageInputId = `${fileInputId}-image`;
  const videoInputId = `${fileInputId}-video`;
  const mobileCameraInputId = `${fileInputId}-camera`;
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageBottomRef = useRef<HTMLDivElement | null>(null);
  const previousFirstMessageIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const lastViewportBottomRef = useRef<boolean | null>(null);
  const pendingScrollToBottomOnLoadRef = useRef(false);

  const quickEmojis = ["😀", "😂", "😍", "👍", "🔥", "🙏", "🎉", "💬"];

  const currentUserId = myProfile?.id ?? currentUserIdFallback;
  const pollSummaries = useMemo(
    () => buildPollSummaries(messages, currentUserId, userProfileMap),
    [messages, currentUserId, userProfileMap],
  );

  const mappedFromServer = useMemo(() => {
    return messages
      .filter((item) => !isPollVoteEventMessage(item))
      .map((item) =>
      mapToUiMessage(item, language, currentUserId, userProfileMap),
      );
  }, [messages, language, currentUserId, userProfileMap]);

  const pinnedSourceMessageIdSet = useMemo(
    () => new Set((pinnedMessages ?? []).map((item) => item.sourceMessageId)),
    [pinnedMessages],
  );

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
    const nextCount = localMessages.length;
    if (nextCount <= 0) {
      previousFirstMessageIdRef.current = null;
      previousLastMessageIdRef.current = null;
      return;
    }

    const firstMessageId = localMessages[0]?.id ?? null;
    const lastMessageId = localMessages[nextCount - 1]?.id ?? null;
    const previousFirst = previousFirstMessageIdRef.current;
    const previousLast = previousLastMessageIdRef.current;
    const scrollContainer = messageListRef.current;

    const isInitialPaint = previousLast === null;
    const appendedNewMessage =
      previousLast !== null &&
      lastMessageId !== null &&
      lastMessageId !== previousLast;
    const prependedOlderMessages =
      previousFirst !== null &&
      firstMessageId !== null &&
      firstMessageId !== previousFirst &&
      previousLast === lastMessageId;

    const nearBottom =
      !scrollContainer ||
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight <
      120;

    if (isInitialPaint) {
      messageBottomRef.current?.scrollIntoView({ behavior: "auto" });
    } else if (appendedNewMessage && nearBottom) {
      messageBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (prependedOlderMessages) {
      // Keep current viewport when older messages are prepended.
    }

    previousFirstMessageIdRef.current = firstMessageId;
    previousLastMessageIdRef.current = lastMessageId;
  }, [localMessages]);

  useEffect(() => {
    previousFirstMessageIdRef.current = null;
    previousLastMessageIdRef.current = null;
    pendingScrollToBottomOnLoadRef.current = true;
    setReplyingTo(null);
  }, [activeConversation?.id]);

  useEffect(() => {
    if (isLoadingMessages) {
      return;
    }
    if (!pendingScrollToBottomOnLoadRef.current) {
      return;
    }
    if (localMessages.length === 0) {
      return;
    }

    pendingScrollToBottomOnLoadRef.current = false;
    window.requestAnimationFrame(() => {
      messageBottomRef.current?.scrollIntoView({ behavior: "auto" });
      notifyViewportBottom(messageListRef.current);
    });
  }, [isLoadingMessages, localMessages]);

  const handleLoadOlderMessages = async () => {
    const scrollContainer = messageListRef.current;
    const previousScrollHeight = scrollContainer?.scrollHeight ?? 0;
    const previousScrollTop = scrollContainer?.scrollTop ?? 0;

    await onLoadOlderMessages();

    if (!scrollContainer) {
      return;
    }

    window.requestAnimationFrame(() => {
      const nextScrollHeight = scrollContainer.scrollHeight;
      const heightDelta = nextScrollHeight - previousScrollHeight;
      scrollContainer.scrollTop = previousScrollTop + Math.max(0, heightDelta);
    });
  };

  useEffect(() => {
    return () => {
      previewFiles.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [previewFiles]);

  const notifyViewportBottom = (scrollContainer: HTMLDivElement | null) => {
    if (!scrollContainer) {
      return;
    }

    const atBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight <
      100;

    if (lastViewportBottomRef.current === atBottom) {
      return;
    }

    lastViewportBottomRef.current = atBottom;
    onViewportBottomChange?.(atBottom);
  };

  useEffect(() => {
    notifyViewportBottom(messageListRef.current);
  }, [localMessages]);

  const jumpToMessageById = (messageId: string) => {
    if (!messageId) {
      return;
    }

    const elementId = `chat-message-${messageId}`;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(elementId);
      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      window.setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1400);
    });
  };

  useEffect(() => {
    if (!scrollToMessageRequest?.messageId) {
      return;
    }

    jumpToMessageById(scrollToMessageRequest.messageId);
  }, [scrollToMessageRequest]);

  const inferFileKind = (file: File): "image" | "video" | "file" => {
    const mime = (file.type ?? "").toLowerCase();
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "avif", "jfif"].includes(ext)) {
      return "image";
    }
    if (mime.startsWith("video/") || ["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) {
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

    await onSendMessage({ parentMessageId: replyingTo?.id ?? null });
    setReplyingTo(null);

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
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#0f1724] p-6 text-center sm:p-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.20),rgba(15,23,36,0.92)_55%)]" />
          <div className="absolute left-[-8%] top-[-10%] h-[42%] w-[38%] rounded-full bg-sky-600/20 blur-[130px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[44%] w-[40%] rounded-full bg-indigo-700/20 blur-[140px]" />
        </div>

        <div className="relative z-10 max-w-xl rounded-3xl border border-slate-700/60 bg-slate-900/50 p-8 shadow-2xl backdrop-blur">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/40">
            <Sparkles size={32} />
          </div>
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-slate-100">
            {language === "vi" ? "Chon cuoc tro chuyen" : "Pick a conversation"}
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            {language === "vi"
              ? "Danh sach ben trai theo phong cach Zalo. Chon mot doan chat de bat dau, khung nhap tin se luon nam o day man hinh."
              : "Use the Zalo-style list on the left. Select a chat to start, the composer stays pinned at the bottom."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0f1724]">
      <header className="flex h-16 items-center justify-between border-b border-slate-700/80 bg-[#182433] px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-200">
            {activeConversation.name.slice(0, 2).toUpperCase()}
            <span
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#182433] ${activeConversationOnline ? "bg-emerald-500" : "bg-slate-500"}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100">
                {activeConversation.name}
              </h3>
              {activeConversationPinned && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                  <Pin size={10} className="mr-1" />
                  {language === "vi" ? "Ghim" : "Pinned"}
                </span>
              )}
              {headerUnreadBadgeCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {headerUnreadBadgeCount > 9 ? "9+" : headerUnreadBadgeCount}
                </span>
              )}
            </div>
            <p
              className={`text-xs ${activeConversationOnline ? "text-emerald-300" : "text-slate-400"}`}
            >
              {activeConversationPresenceLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-300">
          <button
            type="button"
            onClick={onVoiceCall}
            className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-700/70 hover:text-white"
          >
            <Phone size={18} />
          </button>
          <button
            type="button"
            onClick={onVideoCall}
            className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-700/70 hover:text-white"
          >
            <Video size={18} />
          </button>
          {showGroupPanelToggle ? (
            <button
              type="button"
              onClick={onToggleGroupPanel}
              className={`grid h-9 w-9 place-items-center rounded-lg border transition-all duration-200 ${isGroupPanelOpen ? "border-sky-400/60 bg-sky-500/20 text-sky-100" : "border-slate-600 text-slate-200 hover:bg-slate-700/70 hover:text-white"}`}
              title={
                language === "vi"
                  ? "Bat/tat bang dieu khien nhom"
                  : "Toggle group control panel"
              }
              aria-label={
                language === "vi"
                  ? "Bat/tat bang dieu khien nhom"
                  : "Toggle group control panel"
              }
            >
              <span className="text-lg font-extrabold leading-none">!</span>
            </button>
          ) : (
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg transition-all duration-200 hover:bg-slate-700/70 hover:text-white"
            >
              <Info size={18} />
            </button>
          )}
        </div>
      </header>

      {latestPinnedSummary && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => setIsPinnedListOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left hover:bg-amber-500/10"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                {language === "vi" ? "Ghim/ghi chu gan nhat" : "Latest pinned/note"}
              </p>
              <p className="truncate text-sm font-semibold text-amber-100">
                <span className="mr-1 inline-flex align-middle">
                  {latestPinnedSummary.itemType === "note" ? <FileText size={14} /> : <Pin size={14} />}
                </span>
                <span className="align-middle">{latestPinnedSummary.title}</span>
              </p>
              {latestPinnedSummary.preview && (
                <p className="truncate text-xs text-amber-100/90">{latestPinnedSummary.preview}</p>
              )}
            </div>
            <span className="shrink-0 rounded-full border border-amber-300/40 bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
              {latestPinnedSummary.count}
            </span>
          </button>

          {isPinnedListOpen && (
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-amber-400/30 bg-[#1a2433] p-2">
              {(pinnedMessages ?? []).length === 0 ? (
                <p className="px-1 py-1 text-xs text-amber-100/80">
                  {language === "vi" ? "Chua co tin nhan ghim" : "No pinned messages"}
                </p>
              ) : (
                (pinnedMessages ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setIsPinnedListOpen(false);
                      jumpToMessageById(item.sourceMessageId);
                    }}
                    className="w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:border-amber-300/40 hover:bg-amber-500/10"
                  >
                    <p className="truncate text-xs font-semibold text-amber-100">
                      <span className="mr-1 inline-flex align-middle">
                        {item.itemType === "note" ? <FileText size={12} /> : <Pin size={12} />}
                      </span>
                      <span className="align-middle">{item.title}</span>
                    </p>
                    {item.preview && <p className="truncate text-[11px] text-amber-100/85">{item.preview}</p>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div
        ref={messageListRef}
        className={`scrollbar-hide relative flex-1 overflow-y-auto bg-[#0f1724] px-4 py-6 ${isDragOverComposer ? "ring-2 ring-sky-400 ring-inset" : ""}`}
        onScroll={() => notifyViewportBottom(messageListRef.current)}
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
          <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-sky-400 bg-sky-900/60">
            <p className="text-sm font-semibold text-sky-100">
              {language === "vi" ? "Tha file de gui" : "Drop files to upload"}
            </p>
          </div>
        )}
        <div className="mx-auto w-full max-w-full lg:max-w-6xl xl:max-w-7xl">
          {isLoadingMessages ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-300"></div>
            </div>
          ) : (
            <div className="flex flex-col">
              {hasMoreMessages && (
                <div className="mb-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      void handleLoadOlderMessages();
                    }}
                    disabled={isLoadingMoreMessages}
                    className="rounded-lg border border-slate-600 bg-slate-800/90 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                const isSystemMessage = (message.rawType ?? "").toUpperCase() === "SYSTEM";

                if (isSystemMessage) {
                  return (
                    <div key={message.id} className="my-3 flex justify-center">
                      <div className="max-w-[90%] rounded-full border border-slate-600 bg-slate-800/80 px-4 py-1.5 text-center text-xs text-slate-200">
                        <span>{message.text}</span>
                        <span className="ml-2 text-[10px] text-slate-400">{message.timestamp}</span>
                      </div>
                    </div>
                  );
                }

                const isMine = message.senderId === currentUserId;
                const prev = localMessages[index - 1];
                const next = localMessages[index + 1];
                const sameAsPrev = prev?.senderId === message.senderId;
                const sameAsNext = next?.senderId === message.senderId;
                const showAvatar = !isMine && !sameAsNext;
                const showMeta = !sameAsNext;
                const senderProfile = userProfileMap[message.senderId];
                const senderDisplayName =
                  senderProfile?.fullName ??
                  (message.senderId === currentUserId
                    ? language === "vi"
                      ? "Ban"
                      : "You"
                    : `User ${message.senderId.slice(0, 8)}`);
                const senderInitial = initials(senderDisplayName);
                const serverMessage = messages.find((item) => item.id === message.id);
                const pollSummary = serverMessage
                  ? pollSummaries.byMessageId.get(serverMessage.id)
                  : undefined;
                const replySource = message.parentMessageId
                  ? messages.find((item) => item.id === message.parentMessageId)
                  : undefined;
                const shouldShowSenderName =
                  activeConversation?.type === "group" && !isMine && !sameAsPrev;
                return (
                  <div
                    key={message.id}
                    id={`chat-message-${message.id}`}
                    data-message-id={message.id}
                    className={sameAsPrev ? "mt-1.5" : "mt-3"}
                  >
                    {highlightedMessageId === message.id && (
                      <div className="mb-1 rounded-lg border border-amber-300/60 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-100">
                        {language === "vi" ? "Tin nhan dang duoc nhay den" : "Jumped to this message"}
                      </div>
                    )}
                    <MessageRenderer
                      message={{
                        ...message,
                        reactions: serverMessage?.reactions,
                        replyPreviewText: replySource?.content,
                        isPinned: pinnedSourceMessageIdSet.has(message.id),
                        poll: pollSummary
                          ? {
                            ...pollSummary,
                            canManagePoll: canManageGroupPoll,
                          }
                          : undefined,
                      }}
                      isMine={isMine}
                      language={language}
                      recipientAvatar={senderInitial}
                      senderName={senderDisplayName}
                      senderAvatarUrl={senderProfile?.avatarUrl ?? null}
                      showSenderName={shouldShowSenderName}
                      showAvatar={showAvatar}
                      showMeta={showMeta}
                      menuPlacement={index <= 1 ? "below" : "above"}
                      onDelete={(messageId) => onDeleteForMe(messageId)}
                      onReply={(target) => {
                        setReplyingTo({
                          id: target.id,
                          text: target.text,
                        });
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
                      onPin={(targetMessage) => onPinMessage?.(targetMessage)}
                      onUnpin={(targetMessage) => onUnpinMessage?.(targetMessage)}
                      onVotePoll={(targetMessage, optionId) => onVotePollMessage?.(targetMessage, optionId)}
                      onClosePoll={(targetMessage) => onClosePollMessage?.(targetMessage)}
                    />
                  </div>
                );
              })}
              <div ref={messageBottomRef} />
            </div>
          )}
        </div>
      </div>

      <footer className="relative mt-auto border-t border-slate-700/80 bg-[#1b2736] px-2 py-2 shadow-[0_-6px_20px_rgba(3,7,18,0.45)] sm:px-3">
        {isTyping && (
          <div className="mb-2 text-xs text-slate-300">
            {language === "vi" ? "Dang go..." : "Typing..."}
          </div>
        )}

        {pendingUploads.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {pendingUploads.map((item) => (
              <div key={item.localId} className="rounded-lg border border-slate-600 bg-slate-800/85 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-100">{item.fileName}</p>
                    <p className="text-[11px] text-slate-300">{item.fileSizeLabel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => {
                          void onRetryUpload(item.localId);
                        }}
                        className="rounded-md border border-sky-300/40 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/10"
                      >
                        {language === "vi" ? "Gui lai" : "Retry"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCancelUpload(item.localId)}
                      className="rounded-md border border-slate-500 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                    >
                      {language === "vi" ? "Huy" : "Cancel"}
                    </button>
                  </div>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700">
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

        {replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-sky-200">
                {language === "vi" ? "Dang tra loi" : "Replying"}
              </p>
              <p className="truncate text-xs text-sky-100">
                {replyingTo.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="shrink-0 rounded-md border border-sky-300/40 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-500/15"
            >
              {language === "vi" ? "Huy" : "Cancel"}
            </button>
          </div>
        )}

        {editingMessage && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-amber-200">
                {language === "vi" ? "Dang chinh sua" : "Editing message"}
              </p>
              <p className="truncate text-xs text-amber-100">
                {editingMessage.originalText}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                onDraftChange("");
              }}
              className="shrink-0 rounded-md border border-amber-300/45 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/15"
            >
              {language === "vi" ? "Huy" : "Cancel"}
            </button>
          </div>
        )}

        {showEmojiPanel && (
          <div className="absolute bottom-[calc(100%+8px)] left-3 z-20 rounded-2xl border border-slate-600 bg-slate-800 p-3 shadow-2xl sm:left-4">
            <div className="grid grid-cols-4 gap-2">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-lg px-2 py-1 text-xl hover:bg-slate-700"
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
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700"
              title={language === "vi" ? "Dinh kem" : "Attachment"}
              aria-label={language === "vi" ? "Dinh kem" : "Attachment"}
            >
              <Paperclip size={18} />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700"
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,image/*,.heic,.heif,.avif,.jfif,video/*,.mkv,.avi"
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
              accept="image/*,.heic,.heif,.avif,.jfif"
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
              accept="video/*,.mkv,.avi"
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
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-700"
              onClick={() => setShowEmojiPanel((prev) => !prev)}
              title={language === "vi" ? "Emoji" : "Emoji"}
            >
              <Smile size={18} />
            </button>
          </div>

          <textarea
            className="max-h-24 min-h-9 resize-none rounded-2xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-sky-400"
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
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-600 px-3 text-sm font-semibold text-rose-300 hover:bg-rose-500/15"
            onClick={() => {
              onDraftChange(`${draftMessage} ❤️`);
            }}
            title={language === "vi" ? "Tim" : "Heart"}
          >
            <Heart size={16} />
          </button>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-sky-600 px-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 disabled:opacity-50"
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
          <div className="absolute bottom-[calc(100%+8px)] left-3 z-20 w-56 rounded-2xl border border-slate-600 bg-slate-800 p-2 shadow-2xl sm:left-4">
            <button
              type="button"
              onClick={() => document.getElementById(imageInputId)?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
            >
              <ImagePlus size={16} />
              <span>{language === "vi" ? "Gui hinh anh" : "Send image"}</span>
            </button>
            <button
              type="button"
              onClick={() => document.getElementById(videoInputId)?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
            >
              <Video size={16} />
              <span>{language === "vi" ? "Gui video" : "Send video"}</span>
            </button>
            <button
              type="button"
              onClick={() => document.getElementById(fileInputId)?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
            >
              <FileText size={16} />
              <span>{language === "vi" ? "Gui tep tin" : "Send file"}</span>
            </button>
            <button
              type="button"
              onClick={() => document.getElementById(mobileCameraInputId)?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
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
    </div>
  );
}
