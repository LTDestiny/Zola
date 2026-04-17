import { memo, useMemo } from "react";
import { ArrowLeft, MoreVertical, Phone, Video } from "lucide-react";
import { getPresenceLabel } from "../../utils/timeFormatter";

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT HEADER COMPONENT - Shows user info with presence status
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatHeaderProps {
  /** User display name */
  name: string;
  /** User avatar (initials) */
  avatar: string;
  /** Avatar URL (if image) */
  avatarUrl?: string | null;
  /** Whether user is online */
  isOnline: boolean;
  /** Last seen timestamp */
  lastSeenAt?: string | null;
  /** Display language */
  language?: 'vi' | 'en';
  /** Whether typing indicator is active */
  isTyping?: boolean;
  /** Callback when back button clicked (mobile) */
  onBack?: () => void;
  /** Callback when voice call button clicked */
  onVoiceCall?: () => void;
  /** Callback when video call button clicked */
  onVideoCall?: () => void;
  /** Callback when menu button clicked */
  onMenu?: () => void;
  /** Show back button (mobile mode) */
  showBackButton?: boolean;
}

/**
 * Chat header component with presence status.
 * 
 * @example
 * <ChatHeader
 *   name="John Doe"
 *   avatar="JD"
 *   isOnline={true}
 *   lastSeenAt="2024-01-15T10:30:00Z"
 *   isTyping={false}
 * />
 */
export const ChatHeader = memo(function ChatHeader({
  name,
  avatar,
  avatarUrl,
  isOnline,
  lastSeenAt,
  language = 'vi',
  isTyping = false,
  onBack,
  onVoiceCall,
  onVideoCall,
  onMenu,
  showBackButton = false,
}: ChatHeaderProps) {
  // Memoize presence label to avoid recalculation
  const presenceLabel = useMemo(() => {
    if (isTyping) {
      return language === 'vi' ? 'Đang nhập...' : 'Typing...';
    }
    return getPresenceLabel(isOnline, lastSeenAt, language);
  }, [isOnline, lastSeenAt, language, isTyping]);

  const presenceColorClass = useMemo(() => {
    if (isTyping) return 'text-blue-500';
    if (isOnline) return 'text-green-600';
    return 'text-gray-500';
  }, [isOnline, isTyping]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
      {/* Left section: Back button + Avatar + Info */}
      <div className="flex items-center gap-3">
        {/* Back button (mobile) */}
        {showBackButton && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mr-1 grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-700"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {/* Avatar with presence indicator */}
        <div className="relative h-10 w-10 shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              {avatar}
            </div>
          )}
          {/* Presence badge */}
          <span
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'
              }`}
            role="status"
            aria-label={isOnline ? 'Online' : 'Offline'}
          />
        </div>

        {/* User info */}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {name}
          </h3>
          <p className={`text-xs ${presenceColorClass}`}>
            {presenceLabel}
          </p>
        </div>
      </div>

      {/* Right section: Action buttons */}
      <div className="flex items-center gap-1">
        {onVoiceCall && (
          <button
            type="button"
            onClick={onVoiceCall}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-700"
            aria-label="Voice call"
          >
            <Phone size={18} />
          </button>
        )}
        {onVideoCall && (
          <button
            type="button"
            onClick={onVideoCall}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-700"
            aria-label="Video call"
          >
            <Video size={18} />
          </button>
        )}
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-700"
            aria-label="More options"
          >
            <MoreVertical size={18} />
          </button>
        )}
      </div>
    </header>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPING INDICATOR BAR - Shows when someone is typing
// ═══════════════════════════════════════════════════════════════════════════════

export interface TypingIndicatorBarProps {
  /** Whether typing indicator should be shown */
  isTyping: boolean;
  /** Name of the person typing (optional) */
  typingUserName?: string;
  /** Display language */
  language?: 'vi' | 'en';
}

/**
 * Typing indicator bar component.
 * Shows below the chat header when someone is typing.
 */
export const TypingIndicatorBar = memo(function TypingIndicatorBar({
  isTyping,
  typingUserName,
  language = 'vi',
}: TypingIndicatorBarProps) {
  if (!isTyping) return null;

  const label = typingUserName
    ? language === 'vi'
      ? `${typingUserName} đang nhập...`
      : `${typingUserName} is typing...`
    : language === 'vi'
      ? 'Đang nhập...'
      : 'Typing...';

  return (
    <div className="flex items-center gap-2 bg-slate-50 px-4 py-1.5 text-xs text-slate-500">
      {/* Animated dots */}
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
      </span>
      <span>{label}</span>
    </div>
  );
});
