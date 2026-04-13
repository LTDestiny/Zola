export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: string;
  status: "sending" | "sent" | "seen";
  type: "text" | "image" | "video" | "file" | "audio";
  rawType?: string;
  isForwarded?: boolean;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  reactions?: string[];
}

export interface ChatMessageProps {
  message: ChatMessage;
  isMine: boolean;
  language: "vi" | "en";
  recipientAvatar?: string;
  showAvatar?: boolean;
  showMeta?: boolean;
  menuPlacement?: "above" | "below";
  onDelete: (messageId: string) => void | Promise<void>;
  onReply: (message: ChatMessage) => void;
  onForward?: (messageId: string) => void | Promise<void>;
  onRecall?: (messageId: string) => void | Promise<void>;
  onReact?: (messageId: string, emoji: string) => void | Promise<void>;
}
