import { type UserProfile } from "../../api/chatApi";
import { normalizeFriendshipStatus } from "../../utils/friendship";

type AddFriendModalProps = {
  language: "vi" | "en";
  open: boolean;
  friendEmail: string;
  onFriendEmailChange: (value: string) => void;
  onClose: () => void;
  onSearch: () => Promise<void>;
  onAddFriend: () => Promise<void>;
  isSearchingFriend: boolean;
  isSubmittingFriend: boolean;
  friendProfile: UserProfile | null;
  friendshipStatus: string;
  canAddFriend: boolean;
};

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AddFriendModal({
  language,
  open,
  friendEmail,
  onFriendEmailChange,
  onClose,
  onSearch,
  onAddFriend,
  isSearchingFriend,
  isSubmittingFriend,
  friendProfile,
  friendshipStatus,
  canAddFriend,
}: AddFriendModalProps) {
  if (!open) return null;

  const normalized = normalizeFriendshipStatus(friendshipStatus);
  const statusText = (() => {
    if (language === "vi") {
      if (normalized === "NONE") return "Nguoi la";
      if (normalized === "PENDING") return "Dang cho xac nhan";
      if (normalized === "ACCEPTED") return "Ban be";
      if (normalized === "BLOCKED") return "Da chan";
      if (normalized === "REJECTED" || normalized === "DECLINED") return "Da tu choi";
      if (normalized === "CANCELLED") return "Da thu hoi loi moi";
      return "Nguoi la";
    }

    if (normalized === "NONE") return "Stranger";
    if (normalized === "PENDING") return "Pending";
    if (normalized === "ACCEPTED") return "Accepted";
    if (normalized === "BLOCKED") return "Blocked";
    if (normalized === "REJECTED" || normalized === "DECLINED") return "Declined";
    if (normalized === "CANCELLED") return "Cancelled";
    return "Stranger";
  })();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-semibold text-slate-900">
          {language === "vi" ? "Them ban bang email" : "Add friend by email"}
        </h3>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <input
            type="email"
            value={friendEmail}
            onChange={(event) => onFriendEmailChange(event.target.value)}
            placeholder="email@example.com"
            className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
          />
          <button
            type="button"
            className="h-11 rounded-lg border border-indigo-600 px-4 text-sm font-semibold text-indigo-600 disabled:opacity-50"
            onClick={() => void onSearch()}
            disabled={isSearchingFriend || !friendEmail.trim()}
          >
            {isSearchingFriend
              ? language === "vi"
                ? "Dang tim"
                : "Searching"
              : language === "vi"
                ? "Tim"
                : "Search"}
          </button>
        </div>

        {friendProfile && (
          <div className="mt-4 grid grid-cols-[56px_1fr] items-center gap-3 rounded-xl border border-slate-200 p-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
              {initials(friendProfile.fullName)}
            </div>
            <div>
              <strong className="block text-sm text-slate-900">
                {friendProfile.fullName}
              </strong>
              <p className="m-0 text-xs text-slate-500">
                {friendProfile.email ?? "-"}
              </p>
              <p className="m-0 text-xs text-slate-500">Status: {statusText}</p>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-300 px-4 text-slate-600"
            onClick={onClose}
          >
            {language === "vi" ? "Dong" : "Close"}
          </button>
          <button
            type="button"
            className="h-10 rounded-lg bg-indigo-600 px-4 font-semibold text-white disabled:opacity-50"
            onClick={() => void onAddFriend()}
            disabled={isSubmittingFriend || !canAddFriend}
          >
            {language === "vi" ? "Ket ban" : "Add friend"}
          </button>
        </div>
      </div>
    </div>
  );
}
