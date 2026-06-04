import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Ban, ChevronDown, ChevronUp, Copy, FileText, Heart, ImagePlus, Info, Paperclip, Phone, Pin, Search, SendHorizontal, Share2, Smile, Sparkles, Trash2, Undo2, UserPlus, Video, X } from "lucide-react";
import { type ConversationItem, type MessageItem, type UserProfile } from "../../../api/chatApi";
import { MessageRenderer, type ChatMessage } from "../MessageRenderer";
import { resolveMediaUrl } from "../../utils/mediaUrl";

// Ownership: direct 1-1 chat message pane. Keep private-chat changes here.
const currentUserIdFallback = "me";
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const RECALL_WINDOW_MS = 5 * 60 * 1000;

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

type DirectConversationPaneProps = {
  language: "vi" | "en";
  activeConversation: ConversationItem | null;
  activeConversationOnline: boolean;
  activeConversationPresenceLabel: string;
  activeConversationPinned?: boolean;
  headerUnreadBadgeCount?: number;
  relationshipBadgeLabel?: string | null;
  conversationNotice?: {
    tone: "warning" | "danger" | "info";
    title: string;
    description: string;
  } | null;
  userProfileMap?: Record<string, UserProfile>;
  onOpenUserProfile?: (userId: string) => void;
  messages: MessageItem[];
  myProfile: UserProfile | null;
  isLoadingMessages: boolean;
  draftMessage: string;
  onDraftChange: (value: string) => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onSendMessage: (options?: { parentMessageId?: string | null }) => Promise<void>;
  onQuickSendText?: (text: string) => Promise<void>;
  onSendFiles: (files: File[], caption: string) => Promise<void>;
  onEditMessage: (messageId: string, nextContent: string) => void | Promise<void>;
  onRecallMessage: (messageId: string) => void | Promise<void>;
  onDeleteForMe: (messageId: string) => void | Promise<void>;
  onForwardMessage: (messageId: string) => void | Promise<void>;
  onForwardMessages?: (messageIds: string[]) => void | Promise<void>;
  onReactMessage: (messageId: string, emoji: string) => void | Promise<void>;
  pinnedMessages?: Array<{
    id: string;
    itemType: "pin" | "note";
    title: string;
    preview: string;
    sourceMessageId: string;
  }>;
  latestPinnedSummary?: {
    itemType: "pin" | "note";
    title: string;
    preview: string;
    sourceMessageId: string;
    count: number;
  } | null;
  onPinMessage?: (message: ChatMessage) => void | Promise<void>;
  onUnpinMessage?: (message: ChatMessage) => void | Promise<void>;
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
  allowComposer?: boolean;
  composerDisabledMessage?: string | null;
  showStrangerActionPrompt?: boolean;
  strangerActionMode?: "add-or-block" | "incoming-request" | "outgoing-request" | null;
  onAddFriendForPeer?: () => void | Promise<void>;
  onAcceptFriendRequestForPeer?: () => void | Promise<void>;
  onDeclineFriendRequestForPeer?: () => void | Promise<void>;
  onCancelFriendRequestForPeer?: () => void | Promise<void>;
  onBlockPeer?: () => void | Promise<void>;
  isUpdatingPeerRelationship?: boolean;
  hasMoreMessages: boolean;
  isLoadingMoreMessages: boolean;
  onLoadOlderMessages: () => void | Promise<void>;
  onViewportBottomChange?: (atBottom: boolean) => void;
  onTogglePin?: () => void;
  showDirectPanelToggle?: boolean;
  isDirectPanelOpen?: boolean;
  onToggleDirectPanel?: () => void;
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
  if (!value) return language === "vi" ? "Không rõ" : "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return language === "vi" ? "Không rõ" : "N/A";
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
    return language === "vi" ? "Thông báo hệ thống" : "System notification";
  }

  const prefixed = content.replace(/^\[System\]\s*/i, "").trim();

  const addedMatch = prefixed.match(/^(\S+)\s+added\s+(\S+)\s+to the group$/i);
  if (addedMatch) {
    const actor = toDisplayNameFromId(addedMatch[1], language, myId, userProfileMap);
    const target = toDisplayNameFromId(addedMatch[2], language, myId, userProfileMap);
    return language === "vi"
      ? `${actor} đã thêm ${target} vào nhóm`
      : `${actor} added ${target} to the group`;
  }

  const removedMatch = prefixed.match(/^(\S+)\s+removed\s+(\S+)\s+from the group$/i);
  if (removedMatch) {
    const actor = toDisplayNameFromId(removedMatch[1], language, myId, userProfileMap);
    const target = toDisplayNameFromId(removedMatch[2], language, myId, userProfileMap);
    return language === "vi"
      ? `${actor} đã xóa ${target} khỏi nhóm`
      : `${actor} removed ${target} from the group`;
  }

  const joinedMatch = prefixed.match(/^(\S+)\s+joined the group via invite link$/i);
  if (joinedMatch) {
    const actor = toDisplayNameFromId(joinedMatch[1], language, myId, userProfileMap);
    return language === "vi"
      ? `${actor} đã tham gia nhóm bằng link mời`
      : `${actor} joined via invite link`;
  }

  const leftMatch = prefixed.match(/^(\S+)\s+left the group$/i);
  if (leftMatch) {
    const actor = toDisplayNameFromId(leftMatch[1], language, myId, userProfileMap);
    return language === "vi"
      ? `${actor} đã rời nhóm`
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
        ? "Bạn đã thu hồi một tin nhắn"
        : "Tin nhắn đã được thu hồi"
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

function normalizeSearchValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function summarizeSearchableMessageText(message: ChatMessage) {
  const rawType = (message.rawType ?? "").toUpperCase();
  if (rawType === "SYSTEM" || message.isRecalled) {
    return "";
  }

  const payload = parseJsonObject(message.text);
  if (!payload) {
    return message.text;
  }

  const summary = String(
    payload.title ??
      payload.question ??
      payload.note ??
      payload.preview ??
      payload.description ??
      payload.link ??
      "",
  ).trim();

  return summary || message.text;
}

function getInlineNoticeMessage(
  message: ChatMessage,
  language: "vi" | "en",
) {
  const rawType = (message.rawType ?? "").toUpperCase();
  if (rawType === "SYSTEM") {
    return message.text;
  }
  if (rawType !== "NOTE") {
    return null;
  }

  const payload = parseJsonObject(message.text);
  if (!payload) {
    return null;
  }

  const kind = String(payload.kind ?? "").toUpperCase();
  if (kind === "PIN_MESSAGE") {
    return language === "vi"
      ? "Đã ghim một tin nhắn"
      : "Pinned a message";
  }
  if (kind === "UNPIN_MESSAGE") {
    return language === "vi"
      ? "Đã bỏ ghim một tin nhắn"
      : "Unpinned a message";
  }

  return null;
}

function matchesMessageSearchQuery(messageText: string, query: string) {
  const normalizedText = normalizeSearchValue(messageText);
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedText || !normalizedQuery) {
    return false;
  }

  if (normalizedText.includes(normalizedQuery)) {
    return true;
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  return queryTokens.length > 0 && queryTokens.every((token) => normalizedText.includes(token));
}

function isInteractiveTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  const interactiveSelector = [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "video",
    "audio",
    "[role='button']",
    "[contenteditable='true']",
    "[data-ignore-chat-focus='true']",
  ].join(",");

  return Boolean(element.closest(interactiveSelector));
}

export function DirectConversationPane({
  language,
  activeConversation,
  activeConversationOnline,
  activeConversationPresenceLabel,
  activeConversationPinned = false,
  headerUnreadBadgeCount = 0,
  relationshipBadgeLabel = null,
  conversationNotice = null,
  userProfileMap = {},
  onOpenUserProfile,
  messages,
  myProfile,
  isLoadingMessages,
  draftMessage,
  onDraftChange,
  onVoiceCall,
  onVideoCall,
  onSendMessage,
  onQuickSendText,
  onSendFiles,
  onEditMessage,
  onRecallMessage,
  onDeleteForMe,
  onForwardMessage,
  onForwardMessages,
  onReactMessage,
  pinnedMessages = [],
  latestPinnedSummary,
  onPinMessage,
  onUnpinMessage,
  pendingUploads,
  onRetryUpload,
  onCancelUpload,
  isSending,
  typingText,
  allowComposer = true,
  composerDisabledMessage = null,
  showStrangerActionPrompt = false,
  strangerActionMode = null,
  onAddFriendForPeer,
  onAcceptFriendRequestForPeer,
  onDeclineFriendRequestForPeer,
  onCancelFriendRequestForPeer,
  onBlockPeer,
  isUpdatingPeerRelationship = false,
  hasMoreMessages,
  isLoadingMoreMessages,
  onLoadOlderMessages,
  onViewportBottomChange,
  onTogglePin,
  showDirectPanelToggle = false,
  isDirectPanelOpen = true,
  onToggleDirectPanel,
}: DirectConversationPaneProps) {
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
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [isPinnedListOpen, setIsPinnedListOpen] = useState(false);
  const pinnedListRef = useRef<HTMLDivElement>(null);
  const pinnedListButtonRef = useRef<HTMLButtonElement>(null);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchMatchIndex, setMessageSearchMatchIndex] = useState(0);
  const [messageSearchFeedback, setMessageSearchFeedback] = useState<string | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectionActionFeedback, setSelectionActionFeedback] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const fileInputId = useId();
  const imageInputId = `${fileInputId}-image`;
  const videoInputId = `${fileInputId}-video`;
  const mobileCameraInputId = `${fileInputId}-camera`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageBottomRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFirstMessageIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const lastViewportBottomRef = useRef<boolean | null>(null);
  const pendingScrollToBottomOnLoadRef = useRef(false);
  const isPointerSelectingRef = useRef(false);
  const pendingPointerSelectionMessageIdRef = useRef<string | null>(null);
  const pointerSelectionModeRef = useRef<"select" | "deselect">("select");

  const quickEmojis = ["😀", "😂", "😍", "👍", "🔥", "🙏", "🎉", "💬"];

  const currentUserId = myProfile?.id ?? currentUserIdFallback;
  const activeConversationPeerId = activeConversation?.participants?.find(
    (participantId) => participantId && participantId !== currentUserId,
  ) ?? null;
  const activeConversationAvatarUrl = resolveMediaUrl(
    userProfileMap[activeConversationPeerId ?? ""]?.avatarUrl ??
    activeConversation?.avatar ??
    null,
  );
  const resolvedStrangerActionMode =
    strangerActionMode ?? (showStrangerActionPrompt ? "add-or-block" : null);
  const mappedFromServer = useMemo(() => {
    return messages
      .filter((item) => !isPollVoteEventMessage(item))
      .map((item) =>
      mapToUiMessage(item, language, currentUserId, userProfileMap),
      );
  }, [messages, language, currentUserId, userProfileMap]);

  const normalizedMessageSearchQuery = useMemo(
    () => normalizeSearchValue(messageSearchQuery),
    [messageSearchQuery],
  );
  const matchedMessages = useMemo(() => {
    if (!normalizedMessageSearchQuery) {
      return [];
    }

    return localMessages.filter((message) => {
      const searchableText = summarizeSearchableMessageText(message);
      return (
        Boolean(searchableText) &&
        matchesMessageSearchQuery(searchableText, normalizedMessageSearchQuery)
      );
    });
  }, [localMessages, normalizedMessageSearchQuery]);
  const selectedMessageIdSet = useMemo(
    () => new Set(selectedMessageIds),
    [selectedMessageIds],
  );
  const selectedMessages = useMemo(
    () => localMessages.filter((message) => selectedMessageIdSet.has(message.id)),
    [localMessages, selectedMessageIdSet],
  );
  const selectedPersistedMessages = useMemo(
    () => selectedMessages.filter((message) => messages.some((item) => item.id === message.id)),
    [messages, selectedMessages],
  );
  const selectedRecallableMessages = useMemo(
    () =>
      selectedPersistedMessages.filter((message) => {
        const source = messages.find((item) => item.id === message.id);
        if (!source) {
          return false;
        }
        if (source.senderId !== currentUserId || source.recalled) {
          return false;
        }
        if (!source.createdAt) {
          return false;
        }
        const createdAtMs = Date.parse(source.createdAt);
        if (Number.isNaN(createdAtMs)) {
          return false;
        }
        return Date.now() - createdAtMs <= RECALL_WINDOW_MS;
      }),
    [currentUserId, messages, selectedPersistedMessages],
  );
  const isMessageSelectionMode = selectedMessageIds.length > 0;

  useEffect(() => {
    setLocalMessages(mappedFromServer);
  }, [mappedFromServer]);

  useEffect(() => {
    setSelectedMessageIds((prev) => {
      const next = prev.filter((id) => localMessages.some((message) => message.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [localMessages]);

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
    setIsMessageSearchOpen(false);
    setMessageSearchQuery("");
    setMessageSearchMatchIndex(0);
    setMessageSearchFeedback(null);
    setSelectedMessageIds([]);
    setSelectionActionFeedback(null);
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!isMessageSearchOpen) {
      return;
    }

    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, [isMessageSearchOpen]);

  useEffect(() => {
    if (!normalizedMessageSearchQuery) {
      setMessageSearchMatchIndex(0);
      setMessageSearchFeedback(null);
      return;
    }

    setMessageSearchMatchIndex(
      matchedMessages.length > 0 ? matchedMessages.length - 1 : 0,
    );
    setMessageSearchFeedback(null);
  }, [normalizedMessageSearchQuery, matchedMessages.length]);

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

  useEffect(() => {
    if (!showEmojiPanel) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (emojiPanelRef.current?.contains(target) || emojiButtonRef.current?.contains(target)) {
        return;
      }
      setShowEmojiPanel(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [showEmojiPanel]);

  useEffect(() => {
    if (!showAttachMenu) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (attachMenuRef.current?.contains(target) || attachButtonRef.current?.contains(target)) {
        return;
      }
      setShowAttachMenu(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [showAttachMenu]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isPinnedListOpen) {
        return;
      }
      if (
        pinnedListRef.current &&
        !pinnedListRef.current.contains(event.target as Node) &&
        pinnedListButtonRef.current &&
        !pinnedListButtonRef.current.contains(event.target as Node)
      ) {
        setIsPinnedListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPinnedListOpen]);

  const openAttachmentInput = (input: HTMLInputElement | null) => {
    if (!input || input.disabled) {
      return;
    }
    input.click();
    setShowAttachMenu(false);
  };

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
    const stopPointerSelection = () => {
      isPointerSelectingRef.current = false;
      pendingPointerSelectionMessageIdRef.current = null;
    };

    window.addEventListener("mouseup", stopPointerSelection);
    return () => {
      window.removeEventListener("mouseup", stopPointerSelection);
    };
  }, []);

  const setMessageSelected = (messageId: string, shouldSelect: boolean) => {
    setSelectedMessageIds((prev) => {
      const exists = prev.includes(messageId);
      if (shouldSelect) {
        if (exists) {
          return prev;
        }
        return [...prev, messageId];
      }
      if (!exists) {
        return prev;
      }
      return prev.filter((id) => id !== messageId);
    });
  };

  const clearSelectedMessages = () => {
    setSelectedMessageIds([]);
    setSelectionActionFeedback(null);
  };

  const beginPointerMessageSelection = (
    event: React.MouseEvent<HTMLDivElement>,
    messageId: string,
  ) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    const shouldSelect = !selectedMessageIdSet.has(messageId);
    pointerSelectionModeRef.current = shouldSelect ? "select" : "deselect";
    pendingPointerSelectionMessageIdRef.current = messageId;
    isPointerSelectingRef.current = false;
    setShowEmojiPanel(false);
    setShowAttachMenu(false);
    setSelectionActionFeedback(null);
  };

  const continuePointerMessageSelection = (
    event: React.MouseEvent<HTMLDivElement>,
    messageId: string,
  ) => {
    const pendingMessageId = pendingPointerSelectionMessageIdRef.current;
    if (!pendingMessageId) {
      return;
    }
    if ((event.buttons & 1) !== 1) {
      isPointerSelectingRef.current = false;
      pendingPointerSelectionMessageIdRef.current = null;
      return;
    }

    const shouldSelect = pointerSelectionModeRef.current === "select";
    if (!isPointerSelectingRef.current) {
      if (messageId === pendingMessageId) {
        return;
      }
      isPointerSelectingRef.current = true;
      setMessageSelected(pendingMessageId, shouldSelect);
    }

    setMessageSelected(messageId, shouldSelect);
  };

  const collectSelectedMessageText = () => {
    return selectedMessages
      .map((message) => summarizeSearchableMessageText(message) || message.text)
      .filter(Boolean)
      .join("\n\n");
  };

  const handleCopySelectedMessages = async () => {
    const selectedText = collectSelectedMessageText();
    if (!selectedText) {
      setSelectionActionFeedback(
        language === "vi"
          ? "Chưa có nội dung để sao chép."
          : "No message content available to copy.",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedText);
      setSelectionActionFeedback(
        language === "vi" ? "Đã sao chép tin nhắn đã chọn." : "Selected messages copied.",
      );
    } catch {
      setSelectionActionFeedback(
        language === "vi" ? "Không thể sao chép lúc này." : "Cannot copy right now.",
      );
    }
  };

  const handleShareSelectedMessages = async () => {
    const selectedIds = selectedPersistedMessages.map((message) => message.id);
    if (selectedIds.length === 0) {
      setSelectionActionFeedback(
        language === "vi"
          ? "Chưa có tin nhắn hợp lệ để chia sẻ."
          : "No valid messages available to share.",
      );
      return;
    }
    if (!onForwardMessages) {
      setSelectionActionFeedback(
        language === "vi"
          ? "Tính năng chia sẻ hiện chưa sẵn sàng."
          : "Sharing is not available here yet.",
      );
      return;
    }

    try {
      await onForwardMessages(selectedIds);
      clearSelectedMessages();
    } catch {
      setSelectionActionFeedback(
        language === "vi" ? "Không thể chia sẻ lúc này." : "Cannot share right now.",
      );
    }
  };

  const handleRecallSelectedMessages = async () => {
    if (selectedRecallableMessages.length === 0) {
      setSelectionActionFeedback(
        language === "vi"
          ? "Chỉ thu hồi được tin nhắn của bạn trong 5 phút."
          : "You can only recall your own messages within 5 minutes.",
      );
      return;
    }

    for (const message of selectedRecallableMessages) {
      await onRecallMessage(message.id);
    }

    const skippedCount = selectedMessages.length - selectedRecallableMessages.length;
    clearSelectedMessages();
    setPolicyModalMessage(
      skippedCount > 0
        ? language === "vi"
          ? `Đã thu hồi ${selectedRecallableMessages.length} tin nhắn, bỏ qua ${skippedCount} tin không hợp lệ.`
          : `Recalled ${selectedRecallableMessages.length} message(s), skipped ${skippedCount} ineligible item(s).`
        : language === "vi"
          ? `Đã thu hồi ${selectedRecallableMessages.length} tin nhắn.`
          : `Recalled ${selectedRecallableMessages.length} message(s).`,
    );
  };

  const handleDeleteSelectedMessages = async () => {
    if (selectedPersistedMessages.length === 0) {
      setSelectionActionFeedback(
        language === "vi" ? "Không có tin nhắn hợp lệ để xóa." : "No valid messages to delete.",
      );
      return;
    }

    for (const message of selectedPersistedMessages) {
      await onDeleteForMe(message.id);
    }

    const deletedCount = selectedPersistedMessages.length;
    clearSelectedMessages();
    setPolicyModalMessage(
      language === "vi"
        ? `Đã xóa ${deletedCount} tin nhắn khỏi khung chat của bạn.`
        : `Deleted ${deletedCount} message(s) from your chat view.`,
    );
  };

  const runMessageSearch = (preferredIndex?: number) => {
    if (!normalizedMessageSearchQuery) {
      setMessageSearchFeedback(
        language === "vi"
          ? "Nhập từ khóa cần tìm trong tin nhắn."
          : "Enter the words you want to find in messages.",
      );
      return;
    }

    if (matchedMessages.length === 0) {
      setMessageSearchFeedback(
        hasMoreMessages
          ? language === "vi"
            ? "Chưa tìm thấy trong các tin nhắn đã tải. Hãy tải thêm tin nhắn cũ hơn rồi thử lại."
            : "No keyword match in loaded messages yet. Load older messages and try again."
          : language === "vi"
            ? "Không tìm thấy tin nhắn chứa cụm từ này."
            : "No matching messages found.",
      );
      return;
    }

    const resolvedIndex = Math.min(
      Math.max(preferredIndex ?? matchedMessages.length - 1, 0),
      matchedMessages.length - 1,
    );
    const targetMessage = matchedMessages[resolvedIndex];

    setMessageSearchMatchIndex(resolvedIndex);
    setMessageSearchFeedback(null);
    jumpToMessageById(targetMessage.id);
  };

  const moveBetweenSearchMatches = (direction: -1 | 1) => {
    if (matchedMessages.length === 0) {
      runMessageSearch();
      return;
    }

    const nextIndex = Math.min(
      Math.max(messageSearchMatchIndex + direction, 0),
      matchedMessages.length - 1,
    );
    runMessageSearch(nextIndex);
  };

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
    if (!text || !allowComposer) {
      return;
    }

    if (editingMessage) {
      if (isMessageActionExpired(editingMessage.id, EDIT_WINDOW_MS)) {
        setPolicyModalMessage(
          language === "vi"
            ? "Không thể sửa tin nhắn vì quá 15p"
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

    try {
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
    } catch (error) {
      setLocalMessages((prev) =>
        prev.map((item) =>
          item.id === localId
            ? {
              ...item,
              status: "upload_failed",
            }
            : item,
        ),
      );
      setPolicyModalMessage(
        error instanceof Error && error.message
          ? error.message
          : language === "vi"
            ? "Không thể gửi tin nhắn. Vui lòng thử lại."
            : "Could not send this message. Please try again.",
      );
    }
  };

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  const focusComposerFromChat = (target: EventTarget | null) => {
    if (!allowComposer) {
      return;
    }

    const element = target instanceof HTMLElement ? target : null;
    if (!element) {
      return;
    }

    if (
      element.closest("[data-message-bubble='true']") ||
      isInteractiveTarget(target)
    ) {
      return;
    }

    composerTextareaRef.current?.focus();
  };

  if (!activeConversation) {
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[var(--color-zola-page)] p-6 text-center sm:p-12">
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
            {language === "vi" ? "Chọn cuộc trò chuyện" : "Pick a conversation"}
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            {language === "vi"
              ? "Danh sách bên trái theo phong cách Zalo. Chọn một đoạn chat để bắt đầu, khung nhập tin sẽ luôn nằm ở đáy màn hình."
              : "Use the Zalo-style list on the left. Select a chat to start, the composer stays pinned at the bottom."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-zola-surface)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-zola-border-strong)] bg-[linear-gradient(180deg,#183654_0%,#14314e_100%)] pl-[52px] pr-3 md:px-5 sm:h-16 sm:pr-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              if (activeConversationPeerId) {
                onOpenUserProfile?.(activeConversationPeerId);
              }
            }}
            className="relative h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10"
          >
            {activeConversationAvatarUrl ? (
              <img
                src={activeConversationAvatarUrl}
                alt={activeConversation.name}
                className="h-9 w-9 rounded-full border border-slate-600/60 object-cover sm:h-10 sm:w-10"
              />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-200 sm:h-10 sm:w-10">
                {activeConversation.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#182433] ${activeConversationOnline ? "bg-emerald-500" : "bg-slate-500"}`}
            />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeConversationPeerId) {
                    onOpenUserProfile?.(activeConversationPeerId);
                  }
                }}
                className="max-w-[42vw] truncate text-sm font-semibold text-slate-100 transition hover:text-sky-300 sm:max-w-none sm:text-base"
              >
                {activeConversation.name}
              </button>
              {activeConversationPinned && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                  <Pin size={10} className="mr-1" />
                  {language === "vi" ? "Ghim" : "Pinned"}
                </span>
              )}
              {relationshipBadgeLabel && (
                <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                  {relationshipBadgeLabel}
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

        <div className="flex shrink-0 items-center gap-0.5 text-slate-300 sm:gap-1">
          <button
            type="button"
            onClick={onVoiceCall}
            disabled={!allowComposer}
            className="grid h-8 w-8 place-items-center rounded-lg border border-transparent transition-all duration-200 hover:border-[#335b89] hover:bg-[#14365f] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 sm:h-9 sm:w-9"
            title={!allowComposer ? composerDisabledMessage ?? (language === "vi" ? "Không thể gọi lúc này" : "Calls are unavailable right now") : undefined}
          >
            <Phone size={18} />
          </button>
          <button
            type="button"
            onClick={() => setIsMessageSearchOpen((prev) => !prev)}
            className={`grid h-8 w-8 place-items-center rounded-lg border transition-all duration-200 sm:h-9 sm:w-9 ${isMessageSearchOpen ? "border-[#5cb1ff] bg-[#1b4f86] text-sky-100" : "border-transparent hover:border-[#335b89] hover:bg-[#14365f] hover:text-white"}`}
            title={language === "vi" ? "Tìm tin nhắn" : "Search messages"}
            aria-label={language === "vi" ? "Tìm tin nhắn" : "Search messages"}
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            onClick={onVideoCall}
            disabled={!allowComposer}
            className="grid h-8 w-8 place-items-center rounded-lg border border-transparent transition-all duration-200 hover:border-[#335b89] hover:bg-[#14365f] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 sm:h-9 sm:w-9"
            title={!allowComposer ? composerDisabledMessage ?? (language === "vi" ? "Không thể gọi lúc này" : "Calls are unavailable right now") : undefined}
          >
            <Video size={18} />
          </button>
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              className={`grid h-8 w-8 place-items-center rounded-lg border transition-all duration-200 sm:h-9 sm:w-9 ${
                activeConversationPinned
                  ? "border-amber-400 bg-amber-500/20 text-amber-300"
                  : "border-transparent hover:border-[#335b89] hover:bg-[#14365f] hover:text-white"
              }`}
              title={
                activeConversationPinned
                  ? language === "vi"
                    ? "Bỏ ghim hội thoại"
                    : "Unpin conversation"
                  : language === "vi"
                    ? "Ghim hội thoại"
                    : "Pin conversation"
              }
              aria-label={
                activeConversationPinned
                  ? language === "vi"
                    ? "Bỏ ghim hội thoại"
                    : "Unpin conversation"
                  : language === "vi"
                    ? "Ghim hội thoại"
                    : "Pin conversation"
              }
            >
              <Pin size={18} />
            </button>
          )}
          {showDirectPanelToggle && (
            <button
              type="button"
              onClick={onToggleDirectPanel}
              className={`grid h-8 w-8 place-items-center rounded-lg border transition-all duration-200 sm:h-9 sm:w-9 ${isDirectPanelOpen ? "border-[#5cb1ff] bg-[#1b4f86] text-sky-100" : "border-[#335b89] text-slate-200 hover:bg-[#14365f] hover:text-white"}`}
              title={
                language === "vi"
                  ? "Bật/tắt bảng điều khiển"
                  : "Toggle control panel"
              }
            >
              <Info size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {latestPinnedSummary && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 sm:px-6">
            <button
              ref={pinnedListButtonRef}
              type="button"
              onClick={() => setIsPinnedListOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left hover:bg-amber-500/10"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  {language === "vi" ? "Ghim/ghi chú gần nhất" : "Latest pinned/note"}
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
              <div ref={pinnedListRef} className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-amber-400/30 bg-[#1a2433] p-2">
                {(pinnedMessages ?? []).length === 0 ? (
                  <p className="px-1 py-1 text-xs text-amber-100/80">
                    {language === "vi" ? "Chưa có tin nhắn ghim" : "No pinned messages"}
                  </p>
                ) : (
                  (pinnedMessages ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-transparent px-2 py-1.5 hover:border-amber-300/40 hover:bg-amber-500/10"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsPinnedListOpen(false);
                          jumpToMessageById(item.sourceMessageId);
                        }}
                        className="w-full text-left"
                      >
                        <p className="truncate text-xs font-semibold text-amber-100">
                          <span className="mr-1 inline-flex align-middle">
                            {item.itemType === "note" ? <FileText size={12} /> : <Pin size={12} />}
                          </span>
                          <span className="align-middle">{item.title}</span>
                        </p>
                        {item.preview && <p className="truncate text-[11px] text-amber-100/85">{item.preview}</p>}
                      </button>
                      {item.itemType === "pin" && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const sourceMessage = localMessages.find((msg) => msg.id === item.sourceMessageId);
                            void onUnpinMessage?.(
                              sourceMessage ?? ({ id: item.sourceMessageId, text: item.preview } as ChatMessage)
                            );
                          }}
                          className="mt-1 flex w-full items-center gap-1.5 rounded p-1 text-xs text-amber-200/80 hover:bg-amber-500/20 hover:text-amber-100"
                        >
                          <Ban size={12} />
                          {language === "vi" ? "Bỏ ghim" : "Unpin"}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

      {conversationNotice && (
        <div
          className={`border-b px-4 py-3 text-sm sm:px-5 ${conversationNotice.tone === "danger"
            ? "border-rose-400/20 bg-rose-500/12"
            : conversationNotice.tone === "warning"
              ? "border-amber-300/20 bg-amber-500/12"
              : "border-sky-300/20 bg-sky-500/10"
            }`}
        >
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${conversationNotice.tone === "danger"
              ? "text-rose-200"
              : conversationNotice.tone === "warning"
                ? "text-amber-200"
                : "text-sky-100"
              }`}>
              {conversationNotice.title}
            </p>
            <p className="mt-1 text-sm text-slate-200">{conversationNotice.description}</p>
          </div>
        </div>
      )}

      {isMessageSearchOpen && (
        <div className="border-b border-[var(--color-zola-border-strong)] bg-[var(--color-zola-panel)] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--color-zola-border)] bg-[#0b213f] px-3 py-2">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={messageSearchQuery}
                onChange={(event) => setMessageSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runMessageSearch();
                  }
                  if (event.key === "Escape") {
                    setIsMessageSearchOpen(false);
                  }
                }}
                placeholder={
                  language === "vi"
                    ? "Nhập từ hoặc cụm từ trong tin nhắn"
                    : "Enter a word or phrase from the message"
                }
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => runMessageSearch()}
                className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400"
              >
                {language === "vi" ? "Tìm tin nhắn" : "Search messages"}
              </button>
              <button
                type="button"
                onClick={() => moveBetweenSearchMatches(-1)}
                disabled={matchedMessages.length === 0 || messageSearchMatchIndex === 0}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#335b89] text-slate-200 transition hover:bg-[#14365f] disabled:cursor-not-allowed disabled:opacity-40"
                title={language === "vi" ? "Kết quả trước" : "Previous match"}
                aria-label={language === "vi" ? "Kết quả trước" : "Previous match"}
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveBetweenSearchMatches(1)}
                disabled={
                  matchedMessages.length === 0 ||
                  messageSearchMatchIndex >= matchedMessages.length - 1
                }
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#335b89] text-slate-200 transition hover:bg-[#14365f] disabled:cursor-not-allowed disabled:opacity-40"
                title={language === "vi" ? "Kết quả tiếp theo" : "Next match"}
                aria-label={language === "vi" ? "Kết quả tiếp theo" : "Next match"}
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMessageSearchOpen(false);
                  setMessageSearchFeedback(null);
                }}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#335b89] text-slate-200 transition hover:bg-[#14365f]"
                title={language === "vi" ? "Đóng tìm kiếm" : "Close search"}
                aria-label={language === "vi" ? "Đóng tìm kiếm" : "Close search"}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-1 font-semibold text-sky-100">
              {language === "vi" ? "So khớp theo từ/cụm từ" : "Word or phrase match"}
            </span>
            {normalizedMessageSearchQuery && matchedMessages.length > 0 && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                {language === "vi"
                  ? `Kết quả ${messageSearchMatchIndex + 1}/${matchedMessages.length}`
                  : `Match ${messageSearchMatchIndex + 1}/${matchedMessages.length}`}
              </span>
            )}
            {messageSearchFeedback && (
              <span className="text-amber-100">{messageSearchFeedback}</span>
            )}
          </div>
        </div>
      )}

      <div
        ref={messageListRef}
        className={`scrollbar-hide relative min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#0d223b_0%,#102841_100%)] px-2 py-4 sm:px-3 ${isDragOverComposer ? "ring-2 ring-sky-400 ring-inset" : ""}`}
        style={{ touchAction: "pan-y", overscrollBehavior: "none" }}
        onClickCapture={(event) => {
          focusComposerFromChat(event.target);
        }}
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
              {language === "vi" ? "Thả file để gửi" : "Drop files to upload"}
            </p>
          </div>
        )}
        <div className="w-full">
          {isLoadingMessages ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
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
                        ? "Đang tải..."
                        : "Loading..."
                      : language === "vi"
                        ? "Tải tin nhắn cũ hơn"
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
                      ? "Bạn"
                      : "You"
                    : `User ${message.senderId.slice(0, 8)}`);
                const senderInitial = initials(senderDisplayName);
                const serverMessage = messages.find((item) => item.id === message.id);
                const replySource = message.parentMessageId
                  ? messages.find((item) => item.id === message.parentMessageId)
                  : undefined;
                const shouldShowSenderName = false;
                const isSelected = selectedMessageIdSet.has(message.id);
                const inlineNoticeMessage = getInlineNoticeMessage(message, language);
                return (
                  <div
                    key={message.id}
                    id={`chat-message-${message.id}`}
                    data-message-id={message.id}
                    className={sameAsPrev ? "mt-1.5" : "mt-3"}
                  >
                    {highlightedMessageId === message.id && (
                      <div className="mb-1 rounded-lg border border-amber-300/60 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-100">
                        {language === "vi" ? "Tin nhắn đang được nhảy đến" : "Jumped to this message"}
                      </div>
                    )}
                    {inlineNoticeMessage && (
                      <div className="my-3 flex justify-center">
                        <div className="max-w-[90%] rounded-full border border-slate-600 bg-slate-800/80 px-4 py-1.5 text-center text-xs text-slate-200">
                          <span>{inlineNoticeMessage}</span>
                          <span className="ml-2 text-[10px] text-slate-400">{message.timestamp}</span>
                        </div>
                      </div>
                    )}
                    {!inlineNoticeMessage && (
                    <MessageRenderer
                      message={{
                        ...message,
                        reactions: serverMessage?.reactions,
                        replyPreviewText: replySource?.content,
                        isPinned: pinnedMessages.some((p) => p.sourceMessageId === message.id),
                        poll: undefined,
                      }}
                      isMine={isMine}
                      language={language}
                      recipientAvatar={senderInitial}
                      senderName={senderDisplayName}
                      senderAvatarUrl={senderProfile?.avatarUrl ?? null}
                      showSenderName={shouldShowSenderName}
                      showAvatar={showAvatar}
                      showMeta={showMeta}
                      onSenderClick={(senderId) => onOpenUserProfile?.(senderId)}
                      selectionModeActive={isMessageSelectionMode}
                      isSelected={isSelected}
                      onSelectionMouseDown={(event) => beginPointerMessageSelection(event, message.id)}
                      onSelectionMouseEnter={(event) => continuePointerMessageSelection(event, message.id)}
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
                              ? "Không thể sửa tin nhắn vì quá 15p"
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
                              ? "Không thể thu hồi tin nhắn vì quá 5p"
                              : "Cannot recall this message after 5 minutes",
                          );
                          return;
                        }

                        return onRecallMessage(messageId);
                      }}
                      onReact={(messageId, emoji) => onReactMessage(messageId, emoji)}
                      onPin={(targetMessage) => onPinMessage?.(targetMessage)}
                      onUnpin={(targetMessage) => onUnpinMessage?.(targetMessage)}
                      canPin={true}
                    />
                    )}
                  </div>
                );
              })}
              <div ref={messageBottomRef} />
            </div>
          )}
        </div>
      </div>
      </div>

      <footer className="relative mt-auto border-t border-[var(--color-zola-border-strong)] bg-[linear-gradient(180deg,#14314e_0%,#122b45_100%)] px-2 py-2 shadow-[0_-6px_20px_rgba(3,7,18,0.45)] sm:px-3">
        {isTyping && (
          <div className="mb-2 text-xs text-slate-300">
            {typingText ?? (language === "vi" ? "Đang gõ..." : "Typing...")}
          </div>
        )}

        {Boolean(resolvedStrangerActionMode) && !isMessageSelectionMode && (
          <div className="mb-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-200">
              {resolvedStrangerActionMode === "incoming-request"
                ? language === "vi"
                  ? "Người này đã gửi lời mời kết bạn cho bạn. Bạn muốn xác nhận hay từ chối?"
                  : "This user sent you a friend request. Accept or decline?"
                : resolvedStrangerActionMode === "outgoing-request"
                  ? language === "vi"
                    ? "Bạn đã gửi lời mời kết bạn. Bạn có muốn thu hồi lời mời này không?"
                    : "You already sent a friend request. Do you want to cancel it?"
                  : language === "vi"
                    ? "Bạn có muốn gửi lời mời kết bạn với người này hoặc chặn họ?"
                    : "Do you want to send a friend request to this user or block them?"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {resolvedStrangerActionMode === "incoming-request" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void onAcceptFriendRequestForPeer?.();
                    }}
                    disabled={isUpdatingPeerRelationship}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserPlus size={13} />
                    {language === "vi" ? "Xác nhận" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onDeclineFriendRequestForPeer?.();
                    }}
                    disabled={isUpdatingPeerRelationship}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300/60 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X size={13} />
                    {language === "vi" ? "Từ chối" : "Decline"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onBlockPeer?.();
                    }}
                    disabled={isUpdatingPeerRelationship}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300/60 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Ban size={13} />
                    {language === "vi" ? "Chặn" : "Block"}
                  </button>
                </>
              )}

              {resolvedStrangerActionMode === "outgoing-request" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void onCancelFriendRequestForPeer?.();
                    }}
                    disabled={isUpdatingPeerRelationship}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300/60 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X size={13} />
                    {language === "vi" ? "Thu hồi lời mời" : "Cancel request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onBlockPeer?.();
                    }}
                    disabled={isUpdatingPeerRelationship}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300/60 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Ban size={13} />
                    {language === "vi" ? "Chặn" : "Block"}
                  </button>
                </>
              )}

              {resolvedStrangerActionMode === "add-or-block" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void onAddFriendForPeer?.();
                    }}
                    disabled={isUpdatingPeerRelationship}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserPlus size={13} />
                    {language === "vi" ? "Kết bạn" : "Add friend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onBlockPeer?.();
                    }}
                    disabled={isUpdatingPeerRelationship}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300/60 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Ban size={13} />
                    {language === "vi" ? "Chặn" : "Block"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {!allowComposer && !isMessageSelectionMode && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {composerDisabledMessage ??
              (language === "vi"
                ? "Bạn không thể nhắn tin trong cuộc trò chuyện này."
                : "You cannot send messages in this conversation.")}
          </div>
        )}

        {allowComposer && pendingUploads.length > 0 && (
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
                        {language === "vi" ? "Gửi lại" : "Retry"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCancelUpload(item.localId)}
                      className="rounded-md border border-slate-500 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                    >
                      {language === "vi" ? "Hủy" : "Cancel"}
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

        {allowComposer && !isMessageSelectionMode && replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-sky-200">
                {language === "vi" ? "Đang trả lời" : "Replying"}
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
              {language === "vi" ? "Hủy" : "Cancel"}
            </button>
          </div>
        )}

        {allowComposer && !isMessageSelectionMode && editingMessage && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-amber-200">
                {language === "vi" ? "Đang chỉnh sửa" : "Editing message"}
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
              {language === "vi" ? "Hủy" : "Cancel"}
            </button>
          </div>
        )}

        {isMessageSelectionMode && (
          <div className="rounded-2xl border border-[#335b89] bg-[#0f2747] px-3 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-sky-500 px-2 text-xs font-bold text-white">
                  {selectedMessageIds.length}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">
                    {language === "vi" ? "Đã chọn tin nhắn" : "Selected messages"}
                  </p>
                  <p className="text-xs text-slate-300">
                    {language === "vi"
                      ? "Giữ và kéo chuột trái qua từ 2 bóng chat trở lên để bắt đầu chọn."
                      : "Hold and drag the left mouse across 2 or more message bubbles to start selecting."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleCopySelectedMessages();
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-[#335b89] px-3 text-sm font-semibold text-slate-100 hover:bg-[#14365f]"
                >
                  <Copy size={15} />
                  {language === "vi" ? "Sao chép" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleShareSelectedMessages();
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-[#335b89] px-3 text-sm font-semibold text-slate-100 hover:bg-[#14365f]"
                >
                  <Share2 size={15} />
                  {language === "vi" ? "Chia sẻ" : "Share"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRecallSelectedMessages();
                  }}
                  disabled={selectedRecallableMessages.length === 0}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-rose-400/40 px-3 text-sm font-semibold text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Undo2 size={15} />
                  {language === "vi" ? "Thu hồi" : "Recall"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteSelectedMessages();
                  }}
                  disabled={selectedPersistedMessages.length === 0}
                  className="inline-flex h-9 items-center gap-1 rounded-full bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={15} />
                  {language === "vi" ? "Xóa" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={clearSelectedMessages}
                  className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-slate-300 hover:bg-white/5"
                >
                  {language === "vi" ? "Hủy" : "Cancel"}
                </button>
              </div>
            </div>

            {(selectionActionFeedback || selectedRecallableMessages.length !== selectedMessages.length) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {selectionActionFeedback && (
                  <span className="text-sky-100">{selectionActionFeedback}</span>
                )}
                {selectedRecallableMessages.length !== selectedMessages.length && (
                  <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-amber-100">
                    {language === "vi"
                      ? `Chỉ ${selectedRecallableMessages.length}/${selectedMessages.length} tin được thu hồi trong 5 phút`
                      : `Only ${selectedRecallableMessages.length}/${selectedMessages.length} message(s) can be recalled within 5 minutes`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {allowComposer && !isMessageSelectionMode && showEmojiPanel && (
          <div
            ref={emojiPanelRef}
            className="absolute bottom-[calc(100%+8px)] left-3 z-20 rounded-2xl border border-[#335b89] bg-[#102d52] p-3 shadow-2xl sm:left-4"
          >
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

        {allowComposer && !isMessageSelectionMode && (
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-end gap-1.5 rounded-2xl border border-[#335b89] bg-[#0f2747] p-1.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              ref={attachButtonRef}
              onClick={() => setShowAttachMenu((prev) => !prev)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#335b89] text-slate-200 hover:bg-[#14365f]"
              title={language === "vi" ? "Đính kèm" : "Attachment"}
              aria-label={language === "vi" ? "Đính kèm" : "Attachment"}
            >
              <Paperclip size={18} />
            </button>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              className="sr-only"
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
              ref={imageInputRef}
              type="file"
              className="sr-only"
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
              ref={videoInputRef}
              type="file"
              className="sr-only"
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
              ref={mobileCameraInputRef}
              type="file"
              className="sr-only"
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
              ref={emojiButtonRef}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#335b89] text-slate-200 hover:bg-[#14365f]"
              onClick={() => setShowEmojiPanel((prev) => !prev)}
              title={language === "vi" ? "Emoji" : "Emoji"}
            >
              <Smile size={18} />
            </button>
          </div>

          <textarea
            ref={composerTextareaRef}
            rows={1}
            className="max-h-24 min-h-9 resize-none rounded-2xl border border-[#335b89] bg-[#0a1b34] px-3 py-1.5 text-sm leading-5 text-slate-100 outline-none placeholder:text-slate-400 focus:border-[#4aa5ff]"
            value={draftMessage}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={
              language === "vi" ? "Nhập tin nhắn..." : "Type a message..."
            }
            onKeyDown={(event) => {
              void handleKeyDown(event);
            }}
          />

          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-[#335b89] px-3 text-sm font-semibold text-rose-300 hover:bg-rose-500/15"
            onClick={() => {
              void onQuickSendText?.("❤️");
            }}
            title={language === "vi" ? "Tìm" : "Heart"}
            disabled={isSending}
          >
            <Heart size={16} />
          </button>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1f8cff] px-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 hover:bg-[#1578e2] disabled:opacity-50"
            onClick={() => {
              void handleSendMessage();
            }}
            disabled={isSending || !draftMessage.trim()}
          >
            <SendHorizontal size={16} />
            {editingMessage
              ? language === "vi"
                ? "Lưu"
                : "Save"
              : language === "vi"
                ? "Gửi"
                : "Send"}
          </button>
        </div>
        )}

        {allowComposer && !isMessageSelectionMode && showAttachMenu && (
          <div ref={attachMenuRef} className="absolute bottom-[calc(100%+8px)] left-3 z-20 w-56 rounded-2xl border border-slate-600 bg-slate-800 p-2 shadow-2xl sm:left-4">
            <button
              type="button"
              onClick={() => openAttachmentInput(imageInputRef.current)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
            >
              <ImagePlus size={16} />
              <span>{language === "vi" ? "Gửi hình ảnh" : "Send image"}</span>
            </button>
            <button
              type="button"
              onClick={() => openAttachmentInput(videoInputRef.current)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
            >
              <Video size={16} />
              <span>{language === "vi" ? "Gửi video" : "Send video"}</span>
            </button>
            <button
              type="button"
              onClick={() => openAttachmentInput(fileInputRef.current)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
            >
              <FileText size={16} />
              <span>{language === "vi" ? "Gửi tệp tin" : "Send file"}</span>
            </button>
            <button
              type="button"
              onClick={() => openAttachmentInput(mobileCameraInputRef.current)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
            >
              <ImagePlus size={16} />
              <span>{language === "vi" ? "Chụp ảnh/Quay nhanh" : "Capture photo/video"}</span>
            </button>
          </div>
        )}
      </footer>

      {previewFiles.length > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">
                {language === "vi" ? "Xem trước trước khi gửi" : "Preview before send"}
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
                placeholder={language === "vi" ? "Thêm chú thích (caption)..." : "Add a caption..."}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={clearPreviewFiles}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                {language === "vi" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmSendPreview();
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {language === "vi" ? "Gửi" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {policyModalMessage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">
              {language === "vi" ? "Thông báo" : "Notice"}
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
