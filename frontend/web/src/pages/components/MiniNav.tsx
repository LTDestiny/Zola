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
    return `relative mx-1.5 flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-all duration-200 ${isActive
        ? "bg-[#1888ff] shadow-[0_6px_20px_rgba(24,136,255,0.45)]"
        : "text-slate-300 hover:bg-[#1b3557] hover:text-white"
        }`;
}

export function MiniNav({ active, onChange, messageBadge = 0, contactsBadge = 0 }: MiniNavProps) {
    return (
        <aside className="flex h-screen w-[4.25rem] shrink-0 flex-col border-r border-[#153760] bg-[#0b2545]">
            <div className="flex h-16 items-center justify-center border-b border-[#153760]">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#1f8cff] text-sm font-extrabold tracking-wide text-white shadow-[0_4px_14px_rgba(31,140,255,0.45)]">
                    ZL
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-1.5 pt-3">
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
                                <span className="absolute -right-1.5 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                                    {messageBadge > 9 ? "9+" : messageBadge}
                                </span>
                            )}
                            {item.key === "contacts" && contactsBadge > 0 && (
                                <span className="absolute -right-1.5 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                                    {contactsBadge > 9 ? "9+" : contactsBadge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="border-t border-[#153760] py-2.5">
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
