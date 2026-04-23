import type { PendingFriendRequestItem, UserProfile } from "../../api/chatApi";

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export type ContactUser = {
  id: string;
  friendshipId: string;
  name: string;
  email: string | null;
  isOnline: boolean;
  presenceLabel: string;
  sortKey: string;
};

export interface ContactsPanelProps {
  language: "vi" | "en";
  pendingFriendRequests: PendingFriendRequestItem[];
  userProfileMap: Record<string, UserProfile>;
  contactUsers: ContactUser[];
  processingFriendshipId: string | null;
  onAcceptFriendRequest: (friendshipId: string) => void;
  onDeclineFriendRequest: (friendshipId: string) => void;
  onRemoveFriend: (friendshipId: string) => void;
  onOpenFriendConversation: (userId: string) => void;
}

export function ContactsPanel({
  language,
  pendingFriendRequests,
  userProfileMap,
  contactUsers,
  processingFriendshipId,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemoveFriend,
  onOpenFriendConversation,
}: ContactsPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-800">
          {language === "vi" ? "Loi moi ket ban" : "Friend Requests"}
        </h2>
      </div>

      <div className="space-y-2 border-b border-slate-200 p-3">
        {pendingFriendRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
            {language === "vi"
              ? "Chua co loi moi. Dung nut Them ban de tim theo email."
              : "No pending request. Use New Message to search by email."}
          </div>
        ) : (
          pendingFriendRequests.map((request) => {
            const profile = userProfileMap[request.requesterId];
            const displayName =
              profile?.fullName ?? `User ${request.requesterId.slice(0, 8)}`;
            const displayEmail = profile?.email ?? request.requesterId;

            return (
              <div
                key={request.friendshipId}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {initials(displayName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {displayEmail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={processingFriendshipId === request.friendshipId}
                    onClick={() => onAcceptFriendRequest(request.friendshipId)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {language === "vi" ? "Chap nhan" : "Accept"}
                  </button>
                  <button
                    type="button"
                    disabled={processingFriendshipId === request.friendshipId}
                    onClick={() => onDeclineFriendRequest(request.friendshipId)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {language === "vi" ? "Tu choi" : "Decline"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 pb-2">
        <h2 className="text-sm font-semibold text-slate-800">
          {language === "vi" ? "Tat ca ban be" : "All Friends"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {contactUsers.map((user) => (
          <div
            key={user.sortKey}
            className="mb-1 flex cursor-pointer items-center justify-between rounded-xl p-3 transition-all duration-200 hover:bg-slate-50"
            onClick={() => onOpenFriendConversation(user.id)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700">{user.name}</p>
                <p
                  className={`text-[11px] ${user.isOnline ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {user.presenceLabel}
                </p>
              </div>
            </div>
            <div className="ml-3 flex shrink-0 items-center gap-2">
              <span className="max-w-25 truncate text-xs text-slate-400">
                {user.email ?? ""}
              </span>
              <button
                type="button"
                disabled={processingFriendshipId === user.friendshipId}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFriend(user.friendshipId);
                }}
                className="rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 transition-all duration-200 hover:bg-rose-50 disabled:opacity-50"
              >
                {language === "vi" ? "Xoa" : "Remove"}
              </button>
            </div>
          </div>
        ))}
        {contactUsers.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
            {language === "vi" ? "Chua co ban be" : "No friends yet"}
          </div>
        )}
      </div>
    </div>
  );
}
