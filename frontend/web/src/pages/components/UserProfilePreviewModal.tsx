import { Ban, MessageCircle, UserPlus, X } from "lucide-react";
import type { UserProfile } from "../../api/chatApi";
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
    return language === "vi" ? "Nu" : "Female";
  }
  if (normalized === "OTHER") {
    return language === "vi" ? "Khac" : "Other";
  }
  return language === "vi" ? "Chua cap nhat" : "Not updated";
}

function formatBirthdate(value: string | null | undefined, language: "vi" | "en") {
  if (!value) {
    return language === "vi" ? "Da an hoac chua cap nhat" : "Hidden or not updated";
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

function friendshipLabel(status: string | undefined, language: "vi" | "en") {
  const normalized = String(status ?? "NONE").trim().toUpperCase();
  if (normalized === "ACCEPTED") {
    return language === "vi" ? "Ban be" : "Friends";
  }
  if (normalized === "PENDING") {
    return language === "vi" ? "Dang cho xac nhan" : "Pending";
  }
  if (normalized === "BLOCKED") {
    return language === "vi" ? "Da chan" : "Blocked";
  }
  if (normalized === "REJECTED" || normalized === "DECLINED") {
    return language === "vi" ? "Da tu choi" : "Declined";
  }
  if (normalized === "CANCELLED" || normalized === "CANCELED") {
    return language === "vi" ? "Da huy loi moi" : "Cancelled";
  }
  return language === "vi" ? "Nguoi la" : "Stranger";
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
  const normalizedFriendshipStatus = friendshipStatus.trim().toUpperCase();
  const isIncomingPending =
    normalizedFriendshipStatus === "PENDING" &&
    friendRequestDirection === "incoming";
  const isOutgoingPending =
    normalizedFriendshipStatus === "PENDING" &&
    friendRequestDirection === "outgoing";
  const isFriend = normalizedFriendshipStatus === "ACCEPTED";
  const isStrangerProfile =
    !isCurrentUser &&
    !blockedByMe &&
    !blockedByPeer &&
    normalizedFriendshipStatus === "NONE";
  const canAddFriend =
    !isCurrentUser &&
    !blockedByMe &&
    !blockedByPeer &&
    normalizedFriendshipStatus !== "ACCEPTED" &&
    normalizedFriendshipStatus !== "PENDING" &&
    normalizedFriendshipStatus !== "BLOCKED";

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/70 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-slate-700 bg-[#1b2028] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h3 className="text-xl font-semibold text-white">
            {language === "vi" ? "Thong tin tai khoan" : "Account info"}
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
                      ? "Tai khoan cua ban"
                      : "Your account"
                    : friendshipLabel(friendshipStatus, language)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {profile.email ?? (language === "vi" ? "Email dang duoc an" : "Email is hidden")}
              </p>
            </div>
          </div>

          {!isCurrentUser && blockedByMe && (
            <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {language === "vi"
                ? "Ban da chan nguoi nay. Ca hai hien khong the nhan tin cho nhau."
                : "You blocked this user. Neither side can send new messages right now."}
            </div>
          )}

          {!isCurrentUser && blockedByPeer && (
            <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {language === "vi"
                ? "Nguoi dung nay da chan tin nhan cua ban. Ca hai hien khong the nhan tin cho nhau."
                : "This user blocked messages with you. Neither side can send new messages right now."}
            </div>
          )}

          {isStrangerProfile && (
            <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {language === "vi"
                ? "Day la nguoi la, chua nam trong danh ba cua ban."
                : "This user is a stranger and is not currently in your contacts."}
            </div>
          )}

          {!isCurrentUser && (
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void onMessage?.()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f5bd7] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1c6df2]"
                >
                  <MessageCircle size={16} />
                  <span>{language === "vi" ? "Nhan tin" : "Message"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (blockedByMe) {
                      void onUnblockUser?.();
                      return;
                    }
                    void onBlockUser?.();
                  }}
                  disabled={isSubmittingBlock}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    blockedByMe
                      ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  <Ban size={16} />
                  <span>
                    {blockedByMe
                      ? language === "vi"
                        ? "Bo chan"
                        : "Unblock"
                      : language === "vi"
                        ? "Chan"
                        : "Block"}
                  </span>
                </button>
              </div>

              {isIncomingPending && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void onAcceptFriendRequest?.()}
                    disabled={isProcessingFriendship}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <UserPlus size={16} />
                    <span>{language === "vi" ? "Chap nhan" : "Accept"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeclineFriendRequest?.()}
                    disabled={isProcessingFriendship}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <X size={16} />
                    <span>{language === "vi" ? "Tu choi" : "Decline"}</span>
                  </button>
                </div>
              )}

              {isOutgoingPending && (
                <button
                  type="button"
                  onClick={() => void onCancelFriendRequest?.()}
                  disabled={isProcessingFriendship}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <X size={16} />
                  <span>{language === "vi" ? "Huy loi moi ket ban" : "Cancel friend request"}</span>
                </button>
              )}

              {isFriend && (
                <button
                  type="button"
                  onClick={() => void onRemoveFriend?.()}
                  disabled={isProcessingFriendship}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300/35 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <X size={16} />
                  <span>{language === "vi" ? "Huy ket ban" : "Remove friend"}</span>
                </button>
              )}

              {(normalizedFriendshipStatus === "NONE" ||
                normalizedFriendshipStatus === "REJECTED" ||
                normalizedFriendshipStatus === "DECLINED" ||
                normalizedFriendshipStatus === "CANCELLED") && (
                <button
                  type="button"
                  onClick={() => void onAddFriend?.()}
                  disabled={!canAddFriend || isSubmittingFriend}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <UserPlus size={16} />
                  <span>{language === "vi" ? "Ket ban" : "Add friend"}</span>
                </button>
              )}

            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/40">
            <div className="border-b border-slate-700 px-5 py-4">
              <h5 className="text-xl font-semibold text-white">
                {language === "vi" ? "Thong tin ca nhan" : "Personal info"}
              </h5>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm text-slate-200">
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <span className="text-slate-400">{language === "vi" ? "Email" : "Email"}</span>
                <span>
                  {profile.email ?? (language === "vi" ? "Email dang duoc an" : "Email is hidden")}
                </span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <span className="text-slate-400">{language === "vi" ? "So dien thoai" : "Phone"}</span>
                <span>
                  {profile.phone ?? (language === "vi" ? "So dien thoai dang duoc an" : "Phone is hidden")}
                </span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <span className="text-slate-400">{language === "vi" ? "Gioi tinh" : "Gender"}</span>
                <span>{normalizeGender(profile.gender, language)}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-4">
                <span className="text-slate-400">{language === "vi" ? "Ngay sinh" : "Birthdate"}</span>
                <span>{formatBirthdate(profile.birthdate, language)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
