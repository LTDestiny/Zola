import {
    MessageSquare,
    Settings,
    UserCircle2,
    Users,
    Bot,
} from "lucide-react";

export type MiniNavTab =
    | "messages"
    | "contacts"
    | "profile"
    | "settings"
    | "chatbot";

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
    { key: "chatbot", icon: Bot, label: "Zola AI" },
];

const bottomItems: NavItem[] = [
    { key: "profile", icon: UserCircle2, label: "Profile" },
    { key: "settings", icon: Settings, label: "Settings" },
];

function navButtonClass(isActive: boolean) {
    return `relative mx-1.5 flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-all duration-200 ${isActive
        ? "bg-[var(--color-zola-accent)] shadow-[0_6px_20px_rgba(41,145,255,0.42)]"
        : "text-slate-300 hover:bg-[var(--color-zola-panel-hover)] hover:text-white"
        }`;
}

export function MiniNav({ active, onChange, messageBadge = 0, contactsBadge = 0 }: MiniNavProps) {
    return (
        <aside className="order-2 flex h-14 w-full shrink-0 flex-row border-t border-[var(--color-zola-border-strong)] bg-[var(--color-zola-sidebar)] md:order-1 md:h-screen md:w-[4.25rem] md:flex-col md:border-b-0 md:border-r md:border-t-0">
            <div className="flex h-14 w-16 items-center justify-center border-r border-[var(--color-zola-border-strong)] md:h-16 md:w-auto md:border-b md:border-r-0">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-zola-accent)] text-sm font-extrabold tracking-wide text-white shadow-[0_4px_14px_rgba(41,145,255,0.4)]">
                    ZL
                </div>
            </div>

            <div className="flex flex-1 flex-row items-center gap-1.5 px-2 md:flex-col md:items-stretch md:px-0 md:pt-3">
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

            <div className="flex border-l border-[var(--color-zola-border-strong)] px-2 md:block md:border-l-0 md:border-t md:px-0 md:py-2.5">
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
