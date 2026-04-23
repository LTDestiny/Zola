import type { UserProfile } from "../../api/chatApi";

function initials(name: string) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "U";
    return parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("");
}

export interface ProfilePanelProps {
    language: "vi" | "en";
    myProfile: UserProfile | null;
    profileFullName: string;
    profilePhone: string;
    profileAvatarUrl: string;
    profileGender: string;
    profileBirthdate: string;
    isUploadingAvatar: boolean;
    isSavingProfile: boolean;
    isDeletingProfile: boolean;
    onChangeFullName: (v: string) => void;
    onChangePhone: (v: string) => void;
    onChangeGender: (v: string) => void;
    onChangeBirthdate: (v: string) => void;
    onSelectAvatar: (file: File | null) => void;
    onSaveProfile: () => void;
    onDeleteProfile: () => void;
}

export function ProfilePanel({
    language,
    myProfile,
    profileFullName,
    profilePhone,
    profileAvatarUrl,
    profileGender,
    profileBirthdate,
    isUploadingAvatar,
    isSavingProfile,
    isDeletingProfile,
    onChangeFullName,
    onChangePhone,
    onChangeGender,
    onChangeBirthdate,
    onSelectAvatar,
    onSaveProfile,
    onDeleteProfile,
}: ProfilePanelProps) {
    return (
        <div className="overflow-y-auto p-4 md:p-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {profileAvatarUrl ? (
                    <img
                        src={profileAvatarUrl}
                        alt="avatar"
                        className="mb-3 h-14 w-14 rounded-full object-cover"
                    />
                ) : (
                    <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                        {initials(myProfile?.fullName ?? "User")}
                    </div>
                )}
                <h2 className="text-base font-semibold text-slate-800">
                    {myProfile?.fullName ?? "User"}
                </h2>
                <p className="text-xs text-slate-500">{myProfile?.email ?? "-"}</p>
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <label className="block text-xs font-semibold text-slate-500">
                    Email
                    <input
                        type="text"
                        value={myProfile?.email ?? ""}
                        readOnly
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
                    />
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                    {language === "vi" ? "Ho ten" : "Full name"}
                    <input
                        type="text"
                        value={profileFullName}
                        onChange={(e) => onChangeFullName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    />
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                    {language === "vi" ? "So dien thoai" : "Phone"}
                    <input
                        type="text"
                        value={profilePhone}
                        onChange={(e) => onChangePhone(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    />
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                    {language === "vi" ? "Avatar (upload)" : "Avatar (upload)"}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onSelectAvatar(e.target.files?.[0] ?? null)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    />
                    {profileAvatarUrl && (
                        <a
                            href={profileAvatarUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block truncate text-[11px] font-normal text-indigo-600 hover:text-indigo-700"
                        >
                            {profileAvatarUrl}
                        </a>
                    )}
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                    {language === "vi" ? "Gioi tinh" : "Gender"}
                    <select
                        value={profileGender}
                        onChange={(e) => onChangeGender(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                        <option value="">
                            {language === "vi" ? "Khong chon" : "Not set"}
                        </option>
                        <option value="MALE">{language === "vi" ? "Nam" : "Male"}</option>
                        <option value="FEMALE">{language === "vi" ? "Nu" : "Female"}</option>
                        <option value="OTHER">{language === "vi" ? "Khac" : "Other"}</option>
                    </select>
                </label>

                <label className="block text-xs font-semibold text-slate-500">
                    {language === "vi" ? "Ngay sinh" : "Birthdate"}
                    <input
                        type="date"
                        value={profileBirthdate}
                        onChange={(e) => onChangeBirthdate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    />
                </label>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onSaveProfile}
                        disabled={isSavingProfile || isUploadingAvatar}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                        {isUploadingAvatar
                            ? language === "vi"
                                ? "Dang tai anh..."
                                : "Uploading avatar..."
                            : isSavingProfile
                                ? language === "vi"
                                    ? "Dang luu..."
                                    : "Saving..."
                                : language === "vi"
                                    ? "Luu thong tin"
                                    : "Save profile"}
                    </button>

                    <button
                        type="button"
                        onClick={onDeleteProfile}
                        disabled={isDeletingProfile}
                        className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50"
                    >
                        {isDeletingProfile
                            ? language === "vi"
                                ? "Dang xoa..."
                                : "Deleting..."
                            : language === "vi"
                                ? "Xoa tai khoan"
                                : "Delete account"}
                    </button>
                </div>
            </div>
        </div>
    );
}
