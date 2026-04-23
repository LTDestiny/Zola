import type { MouseEventHandler } from "react";

export interface ChatMessage {
  id: string;
  text: string;
  isRecalled?: boolean;
  senderId: string;
  timestamp: string;
  status: "uploading" | "sending" | "sent" | "delivered" | "seen" | "upload_failed";
  type: "text" | "image" | "video" | "file" | "audio";
  rawType?: string;
  isForwarded?: boolean;
  isEdited?: boolean;
  parentMessageId?: string;
  replyPreviewText?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  uploadProgress?: number;
  reactions?: string[];
  isPinned?: boolean;
  poll?: {
    pollId: string;
    question: string;
    options: Array<{
      id: string;
      text: string;
      votes: number;
      percent: number;
      selectedByMe: boolean;
      voterIds?: string[];
      voterNames?: string[];
    }>;
    totalVotes: number;
    hasVotedByMe: boolean;
    multipleChoice: boolean;
    allowChangeVote: boolean;
    hideResultsBeforeVote: boolean;
    canViewResults: boolean;
    closedBy?: string | null;
    closedAt?: string | null;
    canManagePoll?: boolean;
    closesAt?: string | null;
    expiresAt?: string | null;
    isClosed: boolean;
  };
  schedule?: {
    scheduleId: string;
    title: string;
    description?: string;
    startsAt: string;
    scope: "self" | "group";
    reminderOffsets: number[];
    repeat: "none" | "daily" | "weekly";
    createdBy: string;
    isCompleted: boolean;
    completedBy?: string | null;
    completedAt?: string | null;
    canManage: boolean;
  };
}

export interface ChatMessageProps {
  message: ChatMessage;
  isMine: boolean;
  language: "vi" | "en";
  selectionModeActive?: boolean;
  isSelected?: boolean;
  recipientAvatar?: string;
  senderName?: string;
  senderAvatarUrl?: string | null;
  showSenderName?: boolean;
  showAvatar?: boolean;
  showMeta?: boolean;
  menuPlacement?: "above" | "below";
  onSelectionMouseDown?: MouseEventHandler<HTMLDivElement>;
  onSelectionMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onDelete: (messageId: string) => void | Promise<void>;
  onReply: (message: ChatMessage) => void;
  onEdit?: (messageId: string, currentText: string) => void | Promise<void>;
  onForward?: (messageId: string) => void | Promise<void>;
  onRecall?: (messageId: string) => void | Promise<void>;
  onReact?: (messageId: string, emoji: string) => void | Promise<void>;
  onPin?: (message: ChatMessage) => void | Promise<void>;
  onUnpin?: (message: ChatMessage) => void | Promise<void>;
  canPin?: boolean;
  onVotePoll?: (message: ChatMessage, optionId: string) => void | Promise<void>;
  onClosePoll?: (message: ChatMessage) => void | Promise<void>;
  onCompleteSchedule?: (message: ChatMessage) => void | Promise<void>;
}
