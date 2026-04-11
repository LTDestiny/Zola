import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addFriend,
  getConversations,
  getFriendshipStatus,
  getMessages,
  getMyProfile,
  searchUserByEmail,
  sendMessage,
  toApiErrorMessage,
  type ConversationItem,
  type MessageItem,
  type UserProfile,
} from "../api/chatApi";
import { useLanguage } from "../i18n/language";

type SettingsTab = "general" | "profile" | "language" | "notification";

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "Z";
  }
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatTime(value: string | null, language: "vi" | "en") {
  if (!value) {
    return language === "vi" ? "Khong ro" : "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return language === "vi" ? "Khong ro" : "N/A";
  }
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function ChatPage() {
  const { language, setLanguage } = useLanguage();

  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [searchText, setSearchText] = useState("");

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");

  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [friendEmail, setFriendEmail] = useState("");
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState("NONE");
  const [isSearchingFriend, setIsSearchingFriend] = useState(false);
  const [isSubmittingFriend, setIsSubmittingFriend] = useState(false);

  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isSettingMenuOpen, setIsSettingMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");

  const [showOnlyUsingZalo, setShowOnlyUsingZalo] = useState(true);
  const [allowDesktopNotification, setAllowDesktopNotification] = useState(true);
  const [allowSoundNotification, setAllowSoundNotification] = useState(true);

  const [bannerMessage, setBannerMessage] = useState("");

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return conversations;
    }
    return conversations.filter(
      (conversation) =>
        conversation.name.toLowerCase().includes(normalizedSearch) ||
        conversation.lastMessage.toLowerCase().includes(normalizedSearch),
    );
  }, [conversations, searchText]);

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const response = await getConversations();
      const items = response.data ?? [];
      setConversations(items);

      if (!activeConversationId && items.length > 0) {
        setActiveConversationId(items[0].id);
      }
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    void fetchConversations();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await getMyProfile();
        setMyProfile(response.data);
      } catch (error) {
        setBannerMessage(toApiErrorMessage(error));
      }
    };
    void fetchProfile();
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const response = await getMessages(activeConversationId);
        setMessages(response.data ?? []);
      } catch (error) {
        setBannerMessage(toApiErrorMessage(error));
      } finally {
        setIsLoadingMessages(false);
      }
    };

    void loadMessages();
  }, [activeConversationId]);

  const openSettings = (tab: SettingsTab) => {
    setSettingsTab(tab);
    setIsSettingsModalOpen(true);
    setIsAvatarMenuOpen(false);
    setIsSettingMenuOpen(false);
  };

  const onSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setMobileView("chat");
  };

  const onSearchFriendByEmail = async () => {
    const email = friendEmail.trim();
    if (!email) {
      return;
    }

    try {
      setIsSearchingFriend(true);
      setFriendProfile(null);
      setFriendshipStatus("NONE");
      const profileResult = await searchUserByEmail(email);
      setFriendProfile(profileResult.data);

      const statusResult = await getFriendshipStatus(profileResult.data.id);
      setFriendshipStatus(statusResult.data.status);
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsSearchingFriend(false);
    }
  };

  const onAddFriend = async () => {
    if (!friendProfile) {
      return;
    }

    try {
      setIsSubmittingFriend(true);
      const result = await addFriend(friendProfile.id);
      setFriendshipStatus(result.data.status);
      setBannerMessage(language === "vi" ? "Da gui loi moi ket ban" : "Friend request sent");
      await fetchConversations();
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    } finally {
      setIsSubmittingFriend(false);
    }
  };

  const onSendMessage = async () => {
    const content = draftMessage.trim();
    if (!content || !activeConversationId) {
      return;
    }

    try {
      const result = await sendMessage(activeConversationId, content);
      setMessages((prev) => [...prev, result.data]);
      setDraftMessage("");
      await fetchConversations();
    } catch (error) {
      setBannerMessage(toApiErrorMessage(error));
    }
  };

  const canAddFriend =
    Boolean(friendProfile) &&
    friendshipStatus !== "PENDING" &&
    friendshipStatus !== "ACCEPTED";

  return (
    <div className="min-h-screen bg-[#ecf0f5] lg:grid lg:grid-cols-[56px_290px_1fr]">
      <aside className="relative hidden lg:grid bg-[#005ae0] text-white grid-rows-[auto_auto_auto_1fr_auto] p-2 gap-1 justify-items-center">
        <button
          type="button"
          className="mt-2 size-10 rounded-full bg-gradient-to-br from-sky-100 to-cyan-200 text-slate-700 font-semibold"
          onClick={() => {
            setIsAvatarMenuOpen((prev) => !prev);
            setIsSettingMenuOpen(false);
          }}
        >
          {initials(myProfile?.fullName ?? "User")}
        </button>

        <button type="button" className="size-10 rounded-xl bg-white/20 text-lg" title="Tin nhan">
          M
        </button>
        <button type="button" className="size-10 rounded-xl hover:bg-white/15 text-lg" title="Danh ba">
          B
        </button>
        <div />

        <button
          type="button"
          className="mb-2 size-10 rounded-xl hover:bg-white/15 text-lg"
          title="Cai dat"
          onClick={() => {
            setIsSettingMenuOpen((prev) => !prev);
            setIsAvatarMenuOpen(false);
          }}
        >
          S
        </button>

        {isAvatarMenuOpen && (
          <div className="absolute left-14 top-4 z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xl">
            <div className="px-3 py-2 border-b border-slate-100">
              <strong className="block text-base">{myProfile?.fullName ?? "User"}</strong>
            </div>
            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-lg">
              Nang cap tai khoan
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-lg"
              onClick={() => openSettings("profile")}
            >
              Ho so cua ban
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-lg"
              onClick={() => openSettings("general")}
            >
              Cai dat
            </button>
            <Link to="/login" className="block px-3 py-2 text-sm hover:bg-slate-100 rounded-lg text-rose-600">
              Dang xuat
            </Link>
          </div>
        )}

        {isSettingMenuOpen && (
          <div className="absolute bottom-14 left-2 z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xl">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-lg"
              onClick={() => openSettings("profile")}
            >
              Thong tin tai khoan
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-lg"
              onClick={() => openSettings("general")}
            >
              Cai dat chung
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-lg"
              onClick={() => openSettings("language")}
            >
              Ngon ngu
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded-lg"
              onClick={() => openSettings("notification")}
            >
              Thong bao
            </button>
          </div>
        )}
      </aside>

      <aside className={`${mobileView === "chat" ? "hidden" : "block"} lg:block border-r border-slate-200 bg-[#f5f7fa]`}>
        <div className="p-3 border-b border-slate-200 sticky top-0 bg-[#f5f7fa] z-20">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white"
              type="text"
              placeholder={language === "vi" ? "Tim kiem" : "Search"}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <button
              type="button"
              className="h-9 px-3 rounded-md border border-zalo-blue text-zalo-blue text-sm font-semibold bg-white"
              onClick={() => setIsAddFriendOpen(true)}
            >
              {language === "vi" ? "Them ban" : "Add friend"}
            </button>
          </div>
        </div>

        <div className="px-3 py-2 flex gap-3 text-sm border-b border-slate-200 bg-white">
          <button type="button" className="text-zalo-blue font-semibold">
            {language === "vi" ? "Tat ca" : "All"}
          </button>
          <button type="button" className="text-slate-500">
            {language === "vi" ? "Chua doc" : "Unread"}
          </button>
          <button type="button" className="text-slate-500">
            {language === "vi" ? "Phan loai" : "Filter"}
          </button>
        </div>

        <ul className="m-0 p-0 list-none overflow-y-auto max-h-[calc(100vh-150px)]">
          {isLoadingConversations && (
            <li className="px-3 py-3 text-sm text-slate-500">{language === "vi" ? "Dang tai du lieu..." : "Loading..."}</li>
          )}

          {!isLoadingConversations && filteredConversations.length === 0 && (
            <li className="px-3 py-3 text-sm text-slate-500">
              {language === "vi" ? "Khong co hoi thoai nao" : "No conversations found"}
            </li>
          )}

          {filteredConversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            return (
              <li
                key={conversation.id}
                className={`grid grid-cols-[44px_1fr_auto] items-start gap-2 px-3 py-2.5 cursor-pointer border-b border-slate-100 ${
                  isActive ? "bg-sky-100" : "hover:bg-slate-100"
                }`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <div className="size-11 rounded-full bg-gradient-to-br from-sky-200 to-cyan-100 grid place-items-center text-xs font-semibold text-slate-700">
                  {initials(conversation.name)}
                </div>
                <div className="min-w-0">
                  <strong className="block text-sm text-slate-900 truncate">{conversation.name}</strong>
                  <p className="m-0 text-xs text-slate-500 truncate">{conversation.lastMessage || "..."}</p>
                </div>
                <div className="grid justify-items-end gap-1 pt-0.5">
                  <span className="text-[11px] text-slate-400">{formatTime(conversation.lastMessageAt, language)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={`${mobileView === "list" ? "hidden" : "grid"} lg:grid grid-rows-[auto_1fr_auto]`}>
        {activeConversation ? (
          <>
            <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
              <div>
                <h3 className="m-0 text-lg font-semibold text-slate-900">{activeConversation.name}</h3>
                <p className="m-0 text-xs text-slate-500">{activeConversation.participants.length} thanh vien</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="lg:hidden h-9 px-3 rounded-lg border border-slate-200 text-sm"
                  onClick={() => setMobileView("list")}
                >
                  Back
                </button>
                <button type="button" className="h-9 px-3 rounded-lg border border-slate-200 text-sm">
                  Call
                </button>
                <button type="button" className="hidden sm:block h-9 px-3 rounded-lg border border-slate-200 text-sm">
                  Video
                </button>
              </div>
            </header>

            <div className="bg-[#f0f2f5] p-4 overflow-y-auto">
              {isLoadingMessages ? (
                <div className="h-full grid place-items-center text-sm text-slate-500">
                  {language === "vi" ? "Dang tai tin nhan..." : "Loading messages..."}
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-slate-500">
                  {language === "vi" ? "Chua co tin nhan nao" : "No messages yet"}
                </div>
              ) : (
                <div className="max-w-3xl mx-auto grid gap-3">
                  {messages.map((message) => {
                    const isMine = message.senderId === myProfile?.id;
                    return (
                      <div
                        key={message.id}
                        className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm ${
                          isMine
                            ? "justify-self-end bg-zalo-blue text-white"
                            : "justify-self-start bg-white text-slate-700 border border-slate-200"
                        }`}
                      >
                        <p className="m-0">{message.content}</p>
                        <span className="text-[11px] opacity-75">{formatTime(message.createdAt, language)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className="h-16 bg-white border-t border-slate-200 px-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <div className="flex gap-1">
                <button type="button" className="h-8 px-2 rounded-md border border-slate-200 text-xs">
                  IMG
                </button>
                <button type="button" className="h-8 px-2 rounded-md border border-slate-200 text-xs">
                  FILE
                </button>
              </div>
              <input
                className="h-9 border-none outline-none text-sm"
                type="text"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={
                  language === "vi"
                    ? `Nhap tin nhan toi ${activeConversation.name}`
                    : `Message ${activeConversation.name}`
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void onSendMessage();
                  }
                }}
              />
              <div className="flex gap-1 items-center">
                <button type="button" className="h-8 px-2 rounded-md border border-slate-200 text-xs">
                  :)
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-md bg-zalo-blue text-white text-xs"
                  onClick={() => void onSendMessage()}
                >
                  {language === "vi" ? "Gui" : "Send"}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <>
            <header className="h-10 border-b border-slate-200 bg-[#d8e6f8] px-4 text-sm text-slate-700 flex items-center justify-center">
              {language === "vi"
                ? "Du lieu chat se hien thi khi ban chon mot hoi thoai tu backend"
                : "Conversation data from backend will show when you select a thread"}
            </header>

            <div className="bg-[#f3f5f8] grid place-items-center p-4">
              <div className="max-w-xl w-full text-center">
                <h2 className="m-0 text-4xl font-semibold text-slate-800">
                  {language === "vi" ? "Chao mung den voi Zalo PC!" : "Welcome to Zalo PC!"}
                </h2>
                <p className="mt-3 text-slate-600">
                  {language === "vi"
                    ? "Tat ca danh sach va tin nhan dang duoc lay truc tiep tu backend API"
                    : "All conversation and message data are loaded directly from backend APIs"}
                </p>
              </div>
            </div>

            <footer className="h-16 bg-white border-t border-slate-200 px-4 flex items-center justify-end">
              <Link to="/login" className="text-sm text-zalo-blue hover:text-blue-700">
                {language === "vi" ? "Dang xuat" : "Sign out"}
              </Link>
            </footer>
          </>
        )}
      </section>

      {isAddFriendOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 border border-slate-200">
            <h3 className="m-0 text-xl font-semibold text-slate-900">
              {language === "vi" ? "Them ban bang email" : "Add friend by email"}
            </h3>
            <p className="mt-2 mb-4 text-sm text-slate-500">
              {language === "vi"
                ? "Nhap email, tim profile tu backend, sau do gui loi moi ket ban"
                : "Enter email, search profile from backend, then send a friend request"}
            </p>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="email"
                value={friendEmail}
                onChange={(event) => setFriendEmail(event.target.value)}
                placeholder="email@example.com"
                className="h-11 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <button
                type="button"
                className="h-11 px-4 rounded-lg border border-zalo-blue text-zalo-blue font-semibold disabled:opacity-50"
                onClick={() => void onSearchFriendByEmail()}
                disabled={isSearchingFriend || !friendEmail.trim()}
              >
                {isSearchingFriend ? (language === "vi" ? "Dang tim" : "Searching") : (language === "vi" ? "Tim" : "Search")}
              </button>
            </div>

            {friendProfile && (
              <div className="mt-4 rounded-xl border border-slate-200 p-3 grid grid-cols-[56px_1fr] gap-3 items-center">
                <div className="size-14 rounded-full bg-gradient-to-br from-sky-200 to-cyan-100 grid place-items-center text-slate-700 font-semibold">
                  {initials(friendProfile.fullName)}
                </div>
                <div>
                  <strong className="block text-sm text-slate-900">{friendProfile.fullName}</strong>
                  <p className="m-0 text-xs text-slate-500">{friendProfile.email ?? "-"}</p>
                  <p className="m-0 text-xs text-slate-500">Status: {friendshipStatus}</p>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="h-10 px-4 rounded-lg border border-slate-300 text-slate-600"
                onClick={() => {
                  setIsAddFriendOpen(false);
                  setFriendEmail("");
                  setFriendProfile(null);
                  setFriendshipStatus("NONE");
                }}
              >
                {language === "vi" ? "Dong" : "Close"}
              </button>
              <button
                type="button"
                className="h-10 px-4 rounded-lg bg-zalo-blue text-white font-semibold disabled:opacity-50"
                onClick={() => void onAddFriend()}
                disabled={isSubmittingFriend || !canAddFriend}
              >
                {language === "vi" ? "Ket ban" : "Add friend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 grid place-items-center p-3 sm:p-4">
          <div className="w-full max-w-4xl h-[86vh] rounded-xl border border-slate-200 bg-[#f1f3f6] grid grid-cols-[210px_1fr] overflow-hidden">
            <aside className="bg-[#f8fafc] border-r border-slate-200 p-3">
              <h4 className="m-0 px-2 py-1 text-2xl font-semibold text-slate-800">
                {language === "vi" ? "Cai dat" : "Settings"}
              </h4>
              <div className="mt-3 grid gap-1 text-sm">
                <button
                  type="button"
                  className={`h-10 px-3 rounded-lg text-left ${settingsTab === "general" ? "bg-[#dbeafe] text-zalo-blue" : "hover:bg-slate-100"}`}
                  onClick={() => setSettingsTab("general")}
                >
                  {language === "vi" ? "Cai dat chung" : "General"}
                </button>
                <button
                  type="button"
                  className={`h-10 px-3 rounded-lg text-left ${settingsTab === "profile" ? "bg-[#dbeafe] text-zalo-blue" : "hover:bg-slate-100"}`}
                  onClick={() => setSettingsTab("profile")}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className={`h-10 px-3 rounded-lg text-left ${settingsTab === "language" ? "bg-[#dbeafe] text-zalo-blue" : "hover:bg-slate-100"}`}
                  onClick={() => setSettingsTab("language")}
                >
                  {language === "vi" ? "Ngon ngu" : "Language"}
                </button>
                <button
                  type="button"
                  className={`h-10 px-3 rounded-lg text-left ${settingsTab === "notification" ? "bg-[#dbeafe] text-zalo-blue" : "hover:bg-slate-100"}`}
                  onClick={() => setSettingsTab("notification")}
                >
                  {language === "vi" ? "Thong bao" : "Notification"}
                </button>
              </div>
            </aside>

            <main className="p-5 sm:p-6 overflow-y-auto">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="size-9 rounded-full border border-slate-300 bg-white text-slate-600"
                  onClick={() => setIsSettingsModalOpen(false)}
                >
                  X
                </button>
              </div>

              {settingsTab === "general" && (
                <div className="grid gap-6 max-w-xl">
                  <section>
                    <h5 className="m-0 text-3xl font-semibold text-slate-800">
                      {language === "vi" ? "Danh ba" : "Contacts"}
                    </h5>
                    <p className="m-0 mt-1 text-sm text-slate-500">
                      {language === "vi"
                        ? "Danh sach ban be hien thi trong danh ba"
                        : "How friend list should appear in contacts"}
                    </p>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 grid gap-3">
                      <label className="flex items-center justify-between text-sm text-slate-700">
                        <span>{language === "vi" ? "Hien thi tat ca ban be" : "Show all friends"}</span>
                        <input
                          type="radio"
                          name="contact-mode"
                          checked={!showOnlyUsingZalo}
                          onChange={() => setShowOnlyUsingZalo(false)}
                        />
                      </label>
                      <label className="flex items-center justify-between text-sm text-slate-700">
                        <span>{language === "vi" ? "Chi hien thi ban dang su dung Zalo" : "Show friends using Zalo"}</span>
                        <input
                          type="radio"
                          name="contact-mode"
                          checked={showOnlyUsingZalo}
                          onChange={() => setShowOnlyUsingZalo(true)}
                        />
                      </label>
                    </div>
                  </section>

                  <section>
                    <h5 className="m-0 text-3xl font-semibold text-slate-800">
                      {language === "vi" ? "Ngon ngu" : "Language"}
                    </h5>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between">
                      <span className="text-sm text-slate-700">
                        {language === "vi" ? "Thay doi ngon ngu" : "Change language"}
                      </span>
                      <select
                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm bg-white"
                        value={language}
                        onChange={(event) => setLanguage(event.target.value as "vi" | "en")}
                      >
                        <option value="vi">Tieng Viet</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </section>

                  <section>
                    <h5 className="m-0 text-3xl font-semibold text-slate-800">
                      {language === "vi" ? "Thong bao" : "Notification"}
                    </h5>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 grid gap-3">
                      <label className="flex items-center justify-between text-sm text-slate-700">
                        <span>{language === "vi" ? "Thong bao desktop" : "Desktop notifications"}</span>
                        <input
                          type="checkbox"
                          checked={allowDesktopNotification}
                          onChange={(event) => setAllowDesktopNotification(event.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between text-sm text-slate-700">
                        <span>{language === "vi" ? "Am thanh thong bao" : "Notification sound"}</span>
                        <input
                          type="checkbox"
                          checked={allowSoundNotification}
                          onChange={(event) => setAllowSoundNotification(event.target.checked)}
                        />
                      </label>
                    </div>
                  </section>
                </div>
              )}

              {settingsTab === "profile" && (
                <div className="max-w-md rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="h-32 bg-gradient-to-r from-sky-500 to-cyan-300" />
                  <div className="px-5 pb-5">
                    <div className="-mt-10 size-20 rounded-full border-4 border-white bg-gradient-to-br from-sky-200 to-cyan-100 grid place-items-center text-xl font-semibold text-slate-700">
                      {initials(myProfile?.fullName ?? "User")}
                    </div>
                    <h4 className="mt-3 mb-1 text-2xl font-semibold text-slate-800">{myProfile?.fullName ?? "User"}</h4>
                    <p className="m-0 text-sm text-slate-500">{myProfile?.email ?? "-"}</p>
                    <div className="mt-4 grid gap-2 text-sm text-slate-700">
                      <p className="m-0">{language === "vi" ? `Gioi tinh: ${myProfile?.gender ?? "Chua cap nhat"}` : `Gender: ${myProfile?.gender ?? "Unknown"}`}</p>
                      <p className="m-0">{language === "vi" ? `Ngay sinh: ${myProfile?.birthdate ?? "Chua cap nhat"}` : `Birthday: ${myProfile?.birthdate ?? "Unknown"}`}</p>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === "language" && (
                <div className="max-w-md rounded-xl border border-slate-200 bg-white p-4 grid gap-3">
                  <h4 className="m-0 text-xl font-semibold text-slate-800">
                    {language === "vi" ? "Ngon ngu" : "Language"}
                  </h4>
                  <button
                    type="button"
                    className={`h-11 rounded-lg border text-left px-3 ${language === "vi" ? "border-zalo-blue text-zalo-blue bg-blue-50" : "border-slate-300"}`}
                    onClick={() => setLanguage("vi")}
                  >
                    Tieng Viet
                  </button>
                  <button
                    type="button"
                    className={`h-11 rounded-lg border text-left px-3 ${language === "en" ? "border-zalo-blue text-zalo-blue bg-blue-50" : "border-slate-300"}`}
                    onClick={() => setLanguage("en")}
                  >
                    English
                  </button>
                </div>
              )}

              {settingsTab === "notification" && (
                <div className="max-w-md rounded-xl border border-slate-200 bg-white p-4 grid gap-3">
                  <h4 className="m-0 text-xl font-semibold text-slate-800">
                    {language === "vi" ? "Thong bao" : "Notification"}
                  </h4>
                  <label className="flex items-center justify-between text-sm text-slate-700">
                    <span>{language === "vi" ? "Thong bao desktop" : "Desktop notifications"}</span>
                    <input
                      type="checkbox"
                      checked={allowDesktopNotification}
                      onChange={(event) => setAllowDesktopNotification(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between text-sm text-slate-700">
                    <span>{language === "vi" ? "Am thanh thong bao" : "Notification sound"}</span>
                    <input
                      type="checkbox"
                      checked={allowSoundNotification}
                      onChange={(event) => setAllowSoundNotification(event.target.checked)}
                    />
                  </label>
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {bannerMessage && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700 shadow-lg">
          {bannerMessage}
        </div>
      )}
    </div>
  );
}
