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
    return `relative flex h-12 w-full items-center justify-center text-white transition-all duration-200 ${isActive
        ? "border-l-4 border-white bg-indigo-800"
        : "border-l-4 border-transparent hover:bg-indigo-800/70"
        }`;
}

export function MiniNav({ active, onChange, messageBadge = 0 }: MiniNavProps) {
    return (
        <aside className="flex h-screen w-20 shrink-0 flex-col bg-indigo-900">
            <div className="flex h-20 items-center justify-center border-b border-indigo-800">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-sm font-extrabold tracking-wide text-white">
                    ZL
                </div>
            </div>

            <div className="flex flex-1 flex-col pt-2">
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
                                <span className="absolute right-3 top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                                    {messageBadge > 99 ? "99+" : messageBadge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="border-t border-indigo-800 py-2">
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
