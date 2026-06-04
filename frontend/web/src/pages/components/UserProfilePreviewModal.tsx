import { Ban, MessageCircle, UserPlus, X } from "lucide-react";
import type { UserProfile } from "../../api/chatApi";
import { normalizeFriendshipStatus } from "../../utils/friendship";
import { resolveMediaUrl } from "../utils/mediaUrl";

type UserProfilePreviewModalProps = {
  language: "vi" | "en";
  profile: UserProfile | null;
  isOpen: boolean;
  isCurrentUser?: boolean;
  friendshipStatus?: string;
  friendRequestDirection?: "incoming" | "outgoing" | null;
  isSubmittingFriend?: boolean;
  isProcessingFriendship?: boolean;
  blockedByMe?: boolean;
  blockedByPeer?: boolean;
  isSubmittingBlock?: boolean;
  onClose: () => void;
  onAddFriend?: () => void | Promise<void>;
  onAcceptFriendRequest?: () => void | Promise<void>;
  onDeclineFriendRequest?: () => void | Promise<void>;
  onCancelFriendRequest?: () => void | Promise<void>;
  onRemoveFriend?: () => void | Promise<void>;
  onMessage?: () => void | Promise<void>;
  onBlockUser?: () => void | Promise<void>;
  onUnblockUser?: () => void | Promise<void>;
};

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

function normalizeGender(value: string | null | undefined, language: "vi" | "en") {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MALE") {
    return language === "vi" ? "Nam" : "Male";
  }
  if (normalized === "FEMALE") {
    return language === "vi" ? "Nữ" : "Female";
  }
  if (normalized === "OTHER") {
    return language === "vi" ? "Khác" : "Other";
  }
  return language === "vi" ? "Chưa cập nhật" : "Not updated";
}

function formatBirthdate(value: string | null | undefined, language: "vi" | "en") {
  if (!value) {
    return language === "vi" ? "Đã ẩn hoặc chưa cập nhật" : "Hidden or not updated";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function friendshipLabel(
  status: string | undefined,
  language: "vi" | "en",
  blockedByMe: boolean,
  blockedByPeer: boolean,
) {
  if (blockedByMe) {
    return language === "vi" ? "Đã chặn" : "You blocked";
  }
  if (blockedByPeer) {
    return language === "vi" ? "Bị chặn" : "Blocked you";
  }

  const normalized = String(status ?? "NONE").trim().toUpperCase();
  if (normalized === "FRIEND") {
    return language === "vi" ? "Bạn bè" : "Friends";
  }
  if (normalized === "FRIENDS") {
    return language === "vi" ? "Bạn bè" : "Friends";
  }
  if (normalized === "OUTGOING_REQUEST" || normalized === "OUTGOING_PENDING") {
    return language === "vi" ? "Đã gửi lời mời" : "Request sent";
  }
  if (normalized === "INCOMING_REQUEST" || normalized === "INCOMING_PENDING") {
    return language === "vi" ? "Lời mời đến" : "Incoming request";
  }
  if (normalized === "BLOCKED_BY_ME") {
    return language === "vi" ? "Đã chặn" : "You blocked";
  }
  if (normalized === "BLOCKED_ME") {
    return language === "vi" ? "Bị chặn" : "Blocked you";
  }
  if (normalized === "ACCEPTED") {
    return language === "vi" ? "Bạn bè" : "Friends";
  }
  if (normalized === "PENDING") {
    return language === "vi" ? "Đang chờ xác nhận" : "Pending";
  }
  if (normalized === "BLOCKED") {
    return language === "vi" ? "Đã chặn" : "Blocked";
  }
  if (normalized === "REJECTED" || normalized === "DECLINED") {
    return language === "vi" ? "Đã từ chối" : "Declined";
  }
  if (normalized === "CANCELLED" || normalized === "CANCELED") {
    return language === "vi" ? "Đã thu hồi lời mời" : "Cancelled";
  }
  return language === "vi" ? "Người lạ" : "Stranger";
}

export function UserProfilePreviewModal({
  language,
  profile,
  isOpen,
  isCurrentUser = false,
  friendshipStatus = "NONE",
  friendRequestDirection = null,
  isSubmittingFriend = false,
  isProcessingFriendship = false,
  blockedByMe = false,
  blockedByPeer = false,
  isSubmittingBlock = false,
  onClose,
  onAddFriend,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onCancelFriendRequest,
  onRemoveFriend,
  onMessage,
  onBlockUser,
  onUnblockUser,
}: UserProfilePreviewModalProps) {
  if (!isOpen || !profile) {
    return null;
  }

  const avatarUrl = resolveMediaUrl(profile.avatarUrl ?? null);
  const normalizedFriendshipStatus = normalizeFriendshipStatus(friendshipStatus);
  const normalizedRelationshipStatus = String(friendshipStatus ?? "NONE")
    .trim()
    .toUpperCase();
  const isBlockedByMe =
    blockedByMe || normalizedRelationshipStatus === "BLOCKED_BY_ME";
  const isBlockedByPeer =
    blockedByPeer || normalizedRelationshipStatus === "BLOCKED_ME";
  const isIncomingPending =
    normalizedRelationshipStatus === "INCOMING_REQUEST" ||
    normalizedRelationshipStatus === "INCOMING_PENDING" ||
    normalizedFriendshipStatus === "PENDING" &&
    friendRequestDirection === "incoming";
  const isOutgoingPending =
    normalizedRelationshipStatus === "OUTGOING_REQUEST" ||
    normalizedRelationshipStatus === "OUTGOING_PENDING" ||
    normalizedFriendshipStatus === "PENDING" &&
    friendRequestDirection === "outgoing";
  const isBlocked = isBlockedByMe || isBlockedByPeer;
  const isFriend =
    normalizedRelationshipStatus === "FRIEND" ||
    normalizedRelationshipStatus === "FRIENDS" ||
    normalizedFriendshipStatus === "ACCEPTED";
  const isStrangerProfile =
    !isCurrentUser &&
    !isBlockedByMe &&
    !isBlockedByPeer &&
    (normalizedRelationshipStatus === "NONE" ||
      normalizedFriendshipStatus === "NONE");
  const canAddFriend =
    !isCurrentUser &&
    !isBlockedByMe &&
    !isBlockedByPeer &&
    !isFriend &&
    !isIncomingPending &&
    !isOutgoingPending;
  const canMessage =
    !isCurrentUser &&
    !isBlockedByMe &&
    !isBlockedByPeer;
  const showActionRow =
    !isCurrentUser &&
    !isBlockedByMe;
  const showPrimaryAddFriend =
    !isBlocked &&
    (normalizedRelationshipStatus === "NONE" ||
      normalizedFriendshipStatus === "NONE" ||
      normalizedFriendshipStatus === "REJECTED" ||
      normalizedFriendshipStatus === "DECLINED" ||
      normalizedFriendshipStatus === "CANCELLED");

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/70 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-slate-700 bg-[#1b2028] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h3 className="text-xl font-semibold text-white">
            {language === "vi" ? "Thông tin tài khoản" : "Account info"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="h-48 w-full bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.35),_transparent_35%),linear-gradient(135deg,_#1c4b8c,_#0d1320_70%)]" />

        <div className="relative px-5 pb-5">
          <div className="-mt-14 flex items-end gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.fullName}
                className="h-28 w-28 rounded-full border-4 border-[#1b2028] object-cover shadow-xl"
              />
            ) : (
              <div className="grid h-28 w-28 place-items-center rounded-full border-4 border-[#1b2028] bg-sky-500/20 text-3xl font-bold text-sky-100 shadow-xl">
                {initials(profile.fullName)}
              </div>
            )}

            <div className="min-w-0 flex-1 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate text-3xl font-semibold text-white">
                  {profile.fullName}
                </h4>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isStrangerProfile
                      ? "bg-amber-400/15 text-amber-100 ring-1 ring-amber-300/30"
                      : "bg-white/10 text-slate-200"
                  }`}
                >
                  {isCurrentUser
                    ? language === "vi"
                      ? "Tài khoản của bạn"
                      : "Your account"
                    : friendshipLabel(friendshipStatus, language, blockedByMe, blockedByPeer)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {profile.email ?? (language === "vi" ? "Email đang được ẩn" : "Email is hidden")}
              </p>
            </div>
          </div>

          {!isCurrentUser && isBlockedByMe && (
            <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {language === "vi"
                ? "Ban da chan nguoi nay. Ca hai hien khong the nhan tin cho nhau."
                : "You blocked this user. Neither side can send new messages right now."}
            </div>
          )}

          {!isCurrentUser && isBlockedByPeer && (
            <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {language === "vi"
                ? "Người dùng này đã chặn bạn. Bạn không thể nhắn tin hoặc gửi lời mời kết bạn."
                : "This user blocked you. Messaging and friend actions are unavailable."}
            </div>
          )}

          {!isCurrentUser && isOutgoingPending && !isBlocked && (
            <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {language === "vi"
                ? "Bạn đã gửi lời mời kết bạn. Bạn có muốn thu hồi lời mời này không?"
                : "You already sent a friend request. Do you want to cancel it?"}
            </div>
          )}

          {!isCurrentUser && (
            <div className="mt-5 space-y-3">
              {isBlockedByMe ? (
                <button
                  type="button"
                  onClick={() => void onUnblockUser?.()}
                  disabled={isSubmittingBlock}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Ban size={16} />
                  <span>{language === "vi" ? "Bỏ chặn" : "Unblock"}</span>
                </button>
              ) : showActionRow ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void onMessage?.()}
                    disabled={!canMessage}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f5bd7] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1c6df2] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    title={
                      canMessage
                        ? undefined
                        : language === "vi"
                          ? "Không thể nhắn tin do trạng thái quan hệ hiện tại không cho phép."
                          : "Messaging is unavailable because of the current relationship status."
                    }
                  >
                    <MessageCircle size={16} />
                    <span>{language === "vi" ? "Nhắn tin" : "Message"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onBlockUser?.()}
                    disabled={isSubmittingBlock || isBlockedByPeer}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Ban size={16} />
                    <span>{language === "vi" ? "Chặn" : "Block"}</span>
                  </button>
                </div>
              ) : null}

              {isIncomingPending && !isBlocked && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void onAcceptFriendRequest?.()}
                    disabled={isProcessingFriendship}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <UserPlus size={16} />
                    <span>{language === "vi" ? "Chấp nhận" : "Accept"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeclineFriendRequest?.()}
                    disabled={isProcessingFriendship}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <X size={16} />
                    <span>{language === "vi" ? "Từ chối" : "Decline"}</span>
                  </button>
                </div>
              )}

              {isOutgoingPending && !isBlocked && (
                <button
                  type="button"
                  onClick={() => void onCancelFriendRequest?.()}
                  disabled={isProcessingFriendship}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <X size={16} />
                  <span>{language === "vi" ? "Thu hồi lời mời" : "Cancel request"}</span>
                </button>
              )}

              {isFriend && !isBlocked && (
                <button
                  type="button"
                  onClick={() => void onRemoveFriend?.()}
                  disabled={isProcessingFriendship}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300/35 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <X size={16} />
                  <span>{language === "vi" ? "Hủy kết bạn" : "Remove friend"}</span>
                </button>
              )}

              {showPrimaryAddFriend && (
                <button
                  type="button"
                  onClick={() => void onAddFriend?.()}
                  disabled={!canAddFriend || isSubmittingFriend}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <UserPlus size={16} />
                  <span>{language === "vi" ? "Kết bạn" : "Add friend"}</span>
                </button>
              )}

              {isBlockedByPeer && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 opacity-60"
                  >
                    <MessageCircle size={16} />
                    <span>{language === "vi" ? "Nhắn tin" : "Message"}</span>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-300 opacity-60"
                  >
                    <UserPlus size={16} />
                    <span>{language === "vi" ? "Kết bạn" : "Add friend"}</span>
                  </button>
                </div>
              )}

            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/40">
            <div className="border-b border-slate-700 px-5 py-4">
              <h5 className="text-xl font-semibold text-white">
                {language === "vi" ? "Thông tin cá nhân" : "Personal info"}
              </h5>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm text-slate-200">
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <span className="text-slate-400">{language === "vi" ? "Email" : "Email"}</span>
                <span>
                  {profile.email ?? (language === "vi" ? "Email đang được ẩn" : "Email is hidden")}
                </span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <span className="text-slate-400">{language === "vi" ? "Số điện thoại" : "Phone"}</span>
                <span>
                  {profile.phone ?? (language === "vi" ? "Số điện thoại đang được ẩn" : "Phone is hidden")}
                </span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <span className="text-slate-400">{language === "vi" ? "Giới tính" : "Gender"}</span>
                <span>{normalizeGender(profile.gender, language)}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <span className="text-slate-400">{language === "vi" ? "Ngày sinh" : "Birthdate"}</span>
                <span>{formatBirthdate(profile.birthdate, language)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
