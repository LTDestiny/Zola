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
}

export interface ChatMessageProps {
  message: ChatMessage;
  isMine: boolean;
  language: "vi" | "en";
  recipientAvatar?: string;
  senderName?: string;
  senderAvatarUrl?: string | null;
  showSenderName?: boolean;
  showAvatar?: boolean;
  showMeta?: boolean;
  menuPlacement?: "above" | "below";
  onDelete: (messageId: string) => void | Promise<void>;
  onReply: (message: ChatMessage) => void;
  onEdit?: (messageId: string, currentText: string) => void | Promise<void>;
  onForward?: (messageId: string) => void | Promise<void>;
  onRecall?: (messageId: string) => void | Promise<void>;
  onReact?: (messageId: string, emoji: string) => void | Promise<void>;
}
