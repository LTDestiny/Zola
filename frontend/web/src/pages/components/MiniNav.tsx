import {
    MessageSquare,
    Phone,
    Settings,
    UserCircle2,
    Users,
} from "lucide-react";

export type MiniNavTab =
    | "messages"
    | "contacts"
    | "calls"
    | "profile"
    | "settings";

export interface MiniNavProps {
    active: MiniNavTab;
    onChange: (tab: MiniNavTab) => void;
    messageBadge?: number;
    contactsBadge?: number;
}

interface NavItem {
    key: MiniNavTab;
    icon: typeof MessageSquare;
    label: string;
}

const middleItems: NavItem[] = [
    { key: "messages", icon: MessageSquare, label: "Messages" },
    { key: "contacts", icon: Users, label: "Contacts" },
    { key: "calls", icon: Phone, label: "Calls" },
];

const bottomItems: NavItem[] = [
    { key: "profile", icon: UserCircle2, label: "Profile" },
    { key: "settings", icon: Settings, label: "Settings" },
];

function navButtonClass(isActive: boolean) {
    return `relative mx-1 flex h-11 w-auto items-center justify-center rounded-xl text-white transition-all duration-200 ${isActive
        ? "bg-sky-600 shadow-lg shadow-sky-900/45"
        : "hover:bg-slate-700/80"
        }`;
}

export function MiniNav({ active, onChange, messageBadge = 0, contactsBadge = 0 }: MiniNavProps) {
    return (
        <aside className="flex h-screen w-16 shrink-0 flex-col bg-[#0d1521]">
            <div className="flex h-16 items-center justify-center border-b border-slate-800">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-600/25 text-sm font-extrabold tracking-wide text-sky-100">
                    ZL
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-1 pt-2">
                {middleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => onChange(item.key)}
                            className={navButtonClass(isActive)}
                            title={item.label}
                        >
                            <Icon size={20} />
                            {item.key === "messages" && messageBadge > 0 && (
                                <span className="absolute right-0 top-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                                    {messageBadge > 9 ? "9+" : messageBadge}
                                </span>
                            )}
                            {item.key === "contacts" && contactsBadge > 0 && (
                                <span className="absolute right-0 top-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                                    {contactsBadge > 9 ? "9+" : contactsBadge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="border-t border-slate-800 py-2">
                {bottomItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => onChange(item.key)}
                            className={navButtonClass(isActive)}
                            title={item.label}
                        >
                            <Icon size={20} />
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}
