import { Copy, Download, FileText, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChatMessage } from "./ChatMessage.types";
import { resolveMediaCandidates } from "../utils/mediaUrl";

type MessageBubbleProps = {
    message: ChatMessage;
    isMine: boolean;
    onVotePoll?: (optionId: string) => void | Promise<void>;
    onClosePoll?: () => void | Promise<void>;
    onCompleteSchedule?: () => void | Promise<void>;
};

function renderTextWithMentions(text: string) {
    const tokens = text.split(/(@[a-zA-Z0-9_.-]+)/g);
    return tokens.map((token, index) => {
        if (!token) {
            return null;
        }
        if (token.startsWith("@")) {
            return (
                <span key={`mention-${index}`} className="rounded bg-amber-100 px-1 text-amber-900">
                    {token}
                </span>
            );
        }
        return <span key={`text-${index}`}>{token}</span>;
    });
}

function formatDuration(value?: string) {
    return value || "00:30";
}

function formatPollDeadline(value?: string | null) {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
    }).format(date);
}

function parseStructuredPayload(raw: string) {
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}

function summarizeStructuredText(raw: string) {
    const parsed = parseStructuredPayload(raw);
    if (!parsed) {
        return raw;
    }

    const kind = String(parsed.kind ?? "").toUpperCase();
    const title = String(parsed.title ?? parsed.question ?? parsed.note ?? parsed.preview ?? "").trim();

    if (kind === "GROUP_POLL") {
        return title || "Poll";
    }
    if (kind === "BOARD_NOTE" || kind === "PIN_MESSAGE" || kind === "UNPIN_MESSAGE") {
        return title || String(parsed.note ?? parsed.preview ?? "Note");
    }

    if (title) {
        return title;
    }

    const link = String(parsed.link ?? "").trim();
    if (link) {
        return link;
    }

    return "";
}

function getStructuredDisplayTitle(payload: Record<string, unknown> | null, fallbackText: string) {
    if (!payload) {
        return fallbackText;
    }

    return String(
        payload["title"] ??
        payload["question"] ??
        payload["note"] ??
        payload["preview"] ??
        payload["description"] ??
        "",
    ).trim();
}

async function downloadMediaToDevice(url: string, preferredFileName: string) {
    const fallback = () => {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = preferredFileName;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    };

    try {
        const response = await fetch(url);
        if (!response.ok) {
            fallback();
            return;
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = preferredFileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(blobUrl);
    } catch {
        fallback();
    }
}

export function MessageBubble({ message, isMine, onVotePoll, onClosePoll, onCompleteSchedule }: MessageBubbleProps) {
    const [isImageLoading, setIsImageLoading] = useState(message.type === "image");
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [audioProgress, setAudioProgress] = useState(25);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [mediaActionNote, setMediaActionNote] = useState<string | null>(null);
    const [mediaCandidateIndex, setMediaCandidateIndex] = useState(0);
    const [isPollDetailOpen, setIsPollDetailOpen] = useState(false);
    const [pollTabOptionId, setPollTabOptionId] = useState<string | null>(null);
    const [pollVoterSearch, setPollVoterSearch] = useState("");

    useEffect(() => {
        setIsImageLoading(message.type === "image");
    }, [message.id, message.type, mediaCandidateIndex]);

    useEffect(() => {
        setMediaCandidateIndex(0);
    }, [message.id, message.mediaUrl]);

    useEffect(() => {
        setMediaActionNote(null);
    }, [message.id, message.mediaUrl, mediaCandidateIndex]);

    useEffect(() => {
        if (!audioPlaying) {
            return;
        }

        const timer = window.setInterval(() => {
            setAudioProgress((prev) => {
                if (prev >= 100) {
                    setAudioPlaying(false);
                    return 100;
                }
                return prev + 2;
            });
        }, 500);

        return () => window.clearInterval(timer);
    }, [audioPlaying]);

    const incomingTone = "bg-slate-800 text-slate-100 border border-slate-700";
    const outgoingTone = "bg-linear-to-br from-sky-600 to-blue-700 text-white";
    const recalledIncomingTone = "border border-amber-300/50 bg-amber-500/15 text-amber-100";
    const recalledOutgoingTone = "border border-amber-300/60 bg-amber-500/20 text-amber-100";
    const isVisualMedia = message.type === "image" || message.type === "video";
    const semanticType = (message.rawType ?? "TEXT").toUpperCase();
    const structuredPayload = parseStructuredPayload(message.text);

    const bubbleFrame = message.isRecalled
        ? `w-fit min-w-fit max-w-[60%] rounded-xl px-3 py-2 shadow-sm ${isMine ? recalledOutgoingTone : recalledIncomingTone}`
        : isVisualMedia
        ? "w-fit min-w-fit max-w-[60%] overflow-hidden rounded-xl shadow-sm"
        : `w-fit min-w-fit max-w-[60%] rounded-xl px-3 py-2 shadow-sm ${isMine ? outgoingTone : incomingTone}`;

    let content: React.ReactNode;

    const mediaCandidates = resolveMediaCandidates(message.mediaUrl);
    const mediaUrl = mediaCandidates[mediaCandidateIndex] ?? undefined;
    const mediaFileName = message.fileName ?? (message.type === "image" ? "image.jpg" : message.type === "video" ? "video.mp4" : "attachment");

    const onMediaPreviewError = () => {
        if (mediaCandidateIndex < mediaCandidates.length - 1) {
            setMediaCandidateIndex((prev) => prev + 1);
            return;
        }
        setMediaActionNote("Image preview failed");
    };

    const copyImageReference = async () => {
        if (!mediaUrl) {
            return;
        }

        try {
            const response = await fetch(mediaUrl);
            const blob = await response.blob();

            if (navigator.clipboard && "write" in navigator.clipboard && typeof window.ClipboardItem !== "undefined") {
                const item = new window.ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                setMediaActionNote("Image copied");
                return;
            }

            await navigator.clipboard.writeText(mediaUrl);
            setMediaActionNote("Image URL copied");
        } catch {
            try {
                await navigator.clipboard.writeText(mediaUrl);
                setMediaActionNote("Image URL copied");
            } catch {
                setMediaActionNote("Cannot copy right now");
            }
        }
    };

    if (message.isRecalled) {
        content = (
                <p className="max-w-full text-sm italic opacity-95">
                    {summarizeStructuredText(message.text) || message.text}
                </p>
            );
    } else {
    switch (message.type) {
        case "image":
            if (!mediaUrl) {
                content = (
                    <div className="grid h-44 w-64 place-items-center rounded-xl bg-slate-900/50 px-3 text-center text-xs text-slate-300">
                        Image unavailable
                    </div>
                );
                break;
            }
            content = (
                <button
                    type="button"
                    onClick={() => setIsImagePreviewOpen(true)}
                    className="relative block overflow-hidden rounded-2xl"
                >
                    {isImageLoading && <div className="absolute inset-0 z-10 animate-pulse bg-slate-200" />}
                    <img
                        src={mediaUrl}
                        alt={message.fileName ?? "image"}
                        className={`h-44 w-64 object-cover transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                        onLoad={() => setIsImageLoading(false)}
                        onError={() => {
                            setIsImageLoading(false);
                            onMediaPreviewError();
                        }}
                    />
                </button>
            );
            break;
        case "video":
            if (!mediaUrl) {
                content = (
                    <div className="grid h-48 w-72 place-items-center rounded-xl bg-slate-900/50 px-3 text-center text-xs text-slate-300">
                        Video unavailable
                    </div>
                );
                break;
            }
            content = (
                <div className="relative overflow-hidden rounded-xl bg-slate-900">
                    <video
                        className="h-48 w-72 object-cover"
                        src={mediaUrl}
                        preload="metadata"
                        onError={onMediaPreviewError}
                    />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white">
                            <Play size={16} className="ml-0.5" />
                        </div>
                    </div>
                    <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 text-[10px] text-white">
                        {formatDuration(message.duration)}
                    </span>
                </div>
            );
            break;
        case "file":
            content = (
                <div className="flex min-w-60 items-center justify-between gap-3 rounded-xl bg-white/85 p-3 text-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
                            <FileText size={16} />
                        </div>
                        <div>
                            <p className="max-w-36 truncate text-sm font-medium">{message.fileName ?? message.text}</p>
                            {message.fileSize && (
                                <p className="text-xs text-slate-500">{message.fileSize}</p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={!mediaUrl}
                        onClick={() => {
                            if (!mediaUrl) {
                                return;
                            }
                            void downloadMediaToDevice(mediaUrl, mediaFileName);
                        }}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100"
                    >
                        Download
                    </button>
                </div>
            );
            break;
        case "audio":
            content = (
                <div className="flex min-w-64 items-center gap-3 rounded-xl bg-white/85 p-3 text-slate-800">
                    <button
                        type="button"
                        onClick={() => setAudioPlaying((prev) => !prev)}
                        className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-white"
                    >
                        <Play size={14} className={audioPlaying ? "opacity-50" : ""} />
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={audioProgress}
                        onChange={(event) => setAudioProgress(Number(event.target.value))}
                        className="h-1 flex-1 accent-indigo-600"
                    />
                    <span className="text-xs text-slate-500">{formatDuration(message.duration)}</span>
                </div>
            );
            break;
        case "text":
        default:
            if (["STICKER", "GIF", "CONTACT", "LOCATION", "POLL", "REMINDER", "NOTE", "MEETING"].includes(semanticType)) {
                const title = getStructuredDisplayTitle(structuredPayload, summarizeStructuredText(message.text));
                const link = typeof structuredPayload?.["link"] === "string" ? structuredPayload["link"] : "";

                if (semanticType === "STICKER") {
                    content = (
                        <div className="text-4xl leading-none">{title || "😀"}</div>
                    );
                    break;
                }

                if (semanticType === "GIF") {
                    const gifUrl = link || title;
                    const isHttp = /^https?:\/\//i.test(gifUrl);
                    content = isHttp ? (
                        <img
                            src={gifUrl}
                            alt="gif"
                            className="max-h-56 w-64 rounded-xl object-cover"
                        />
                    ) : (
                        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700">
                            <p className="font-semibold">GIF</p>
                            <p className="mt-0.5 break-all text-xs">{title}</p>
                        </div>
                    );
                    break;
                }

                if (semanticType === "CONTACT") {
                    content = (
                        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p>
                            <p className="mt-1 text-sm font-semibold">{title}</p>
                        </div>
                    );
                    break;
                }

                if (semanticType === "LOCATION") {
                    content = (
                        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                            <p className="mt-1 text-sm">{title}</p>
                        </div>
                    );
                    break;
                }

                if (semanticType === "POLL") {
                    const pollData = message.poll;
                    if (pollData && pollData.options.length > 0) {
                        const selectedTabId = pollTabOptionId ?? pollData.options[0]?.id ?? null;
                        const selectedOption = pollData.options.find((item) => item.id === selectedTabId) ?? pollData.options[0];
                        const filteredVoterNames = (selectedOption?.voterNames ?? []).filter((name) =>
                            name.toLowerCase().includes(pollVoterSearch.trim().toLowerCase()),
                        );
                        content = (
                            <div className="w-64 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
                                <p className="text-xs font-semibold uppercase tracking-wide">Poll</p>
                                <p className="mt-1 text-sm font-medium">{pollData.question}</p>
                                {pollData.hideResultsBeforeVote && !pollData.canViewResults && (
                                    <p className="mt-1 text-[10px] text-sky-800">Vote first to view results</p>
                                )}
                                <div className="mt-2 space-y-1.5">
                                    {pollData.options.map((option) => (
                                        <div key={option.id} className="rounded-lg border border-sky-200 bg-white/85 px-2 py-1.5 text-left text-xs text-sky-900">
                                            <button
                                                type="button"
                                                disabled={pollData.isClosed}
                                                onClick={() => {
                                                    void onVotePoll?.(option.id);
                                                }}
                                                className={`w-full rounded ${option.selectedByMe ? "bg-sky-200/60" : "hover:bg-sky-100"} px-1 py-0.5 disabled:cursor-not-allowed disabled:opacity-70`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate">{option.text}</span>
                                                    <span className="shrink-0 text-[10px] font-semibold">{pollData.canViewResults ? option.votes : "?"}</span>
                                                </div>
                                                <div className="mt-1 h-1.5 rounded bg-sky-100">
                                                    <div className="h-full rounded bg-sky-500" style={{ width: `${Math.max(0, Math.min(100, option.percent))}%` }} />
                                                </div>
                                            </button>
                                            {pollData.canViewResults && option.voterNames && option.voterNames.length > 0 && (
                                                <p className="mt-1 truncate text-[10px] text-sky-700">
                                                    {option.voterNames.join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-2 text-[10px] text-sky-800">
                                    {pollData.canViewResults ? pollData.totalVotes : "?"} {pollData.totalVotes === 1 ? "vote" : "votes"}
                                    {pollData.multipleChoice ? " • Multi-choice" : " • Single choice"}
                                </p>
                                {formatPollDeadline(pollData.closesAt ?? pollData.expiresAt) && (
                                    <p className="mt-1 text-[10px] text-sky-800">
                                        {pollData.isClosed ? "Closed" : "Closes"}: {formatPollDeadline(pollData.closesAt ?? pollData.expiresAt)}
                                    </p>
                                )}
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPollDetailOpen(true);
                                            setPollTabOptionId(selectedOption?.id ?? null);
                                        }}
                                        className="rounded-md border border-sky-300 px-2 py-1 text-[10px] font-semibold text-sky-800 hover:bg-sky-100"
                                    >
                                        Xem chi tiet
                                    </button>
                                    {pollData.canManagePoll && !pollData.isClosed && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void onClosePoll?.();
                                            }}
                                            className="rounded-md border border-rose-300 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"
                                        >
                                            Ket thuc som
                                        </button>
                                    )}
                                </div>

                                {isPollDetailOpen && (
                                    <div className="fixed inset-0 z-70 grid place-items-center bg-slate-950/75 p-4">
                                        <div className="w-full max-w-xl rounded-2xl border border-slate-600 bg-[#0f1724] p-3 text-slate-100">
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <p className="truncate text-sm font-semibold">Chi tiet binh chon</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsPollDetailOpen(false)}
                                                    className="rounded-md border border-slate-500 px-2 py-1 text-xs hover:bg-slate-700"
                                                >
                                                    Dong
                                                </button>
                                            </div>

                                            <div className="mb-2 flex flex-wrap gap-1">
                                                {pollData.options.map((option) => (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() => setPollTabOptionId(option.id)}
                                                        className={`rounded-full border px-2 py-1 text-[11px] ${pollTabOptionId === option.id ? "border-sky-400 bg-sky-500/20 text-sky-100" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                                                    >
                                                        {option.text}
                                                    </button>
                                                ))}
                                            </div>

                                            <input
                                                type="text"
                                                value={pollVoterSearch}
                                                onChange={(event) => setPollVoterSearch(event.target.value)}
                                                placeholder="Tim nguoi da vote"
                                                className="mb-2 h-9 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-xs text-slate-100"
                                            />

                                            {!pollData.canViewResults ? (
                                                <p className="text-xs text-slate-300">Can bo phieu de xem danh sach nguoi vote</p>
                                            ) : filteredVoterNames.length === 0 ? (
                                                <p className="text-xs text-slate-300">Chua co nguoi vote cho lua chon nay</p>
                                            ) : (
                                                <div className="max-h-56 space-y-1 overflow-y-auto">
                                                    {filteredVoterNames.map((name, index) => (
                                                        <div key={`voter-${selectedOption?.id ?? "none"}-${index}`} className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-xs text-slate-100">
                                                            {name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                        break;
                    }
                    content = (
                        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
                            <p className="text-xs font-semibold uppercase tracking-wide">Poll</p>
                            <p className="mt-1 text-sm font-medium">{title}</p>
                        </div>
                    );
                    break;
                }

                if (semanticType === "REMINDER") {
                    const schedule = message.schedule;
                    if (schedule) {
                        content = (
                            <div className="w-72 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                                <p className="text-xs font-semibold uppercase tracking-wide">Group schedule</p>
                                <p className="mt-1 text-sm font-semibold">{schedule.title}</p>
                                {schedule.description && (
                                    <p className="mt-1 text-xs whitespace-pre-wrap">{schedule.description}</p>
                                )}
                                <p className="mt-1 text-[11px]">Starts: {formatPollDeadline(schedule.startsAt) ?? schedule.startsAt}</p>
                                <p className="mt-0.5 text-[11px]">
                                    Scope: {schedule.scope === "group" ? "Group" : "Only me"}
                                    {schedule.repeat !== "none" ? ` • Repeat ${schedule.repeat}` : ""}
                                </p>
                                <p className="mt-0.5 text-[11px]">
                                    Remind: {schedule.reminderOffsets.length > 0 ? schedule.reminderOffsets.map((offset) => {
                                        if (offset === 0) return "on time";
                                        if (offset < 60) return `${offset}m`;
                                        if (offset < 1440) return `${Math.floor(offset / 60)}h`;
                                        return `${Math.floor(offset / 1440)}d`;
                                    }).join(", ") : "on time"}
                                </p>
                                <p className="mt-1 text-[11px] font-semibold">
                                    Status: {schedule.isCompleted ? "Completed" : "Active"}
                                </p>
                                {schedule.isCompleted && schedule.completedAt && (
                                    <p className="mt-0.5 text-[10px]">Completed at {formatPollDeadline(schedule.completedAt) ?? schedule.completedAt}</p>
                                )}
                                {schedule.canManage && !schedule.isCompleted && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void onCompleteSchedule?.();
                                        }}
                                        className="mt-2 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900 hover:bg-amber-200"
                                    >
                                        Mark completed
                                    </button>
                                )}
                            </div>
                        );
                        break;
                    }
                    content = (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                            <p className="text-xs font-semibold uppercase tracking-wide">Reminder</p>
                            <p className="mt-1 text-sm font-medium">{title}</p>
                        </div>
                    );
                    break;
                }

                if (semanticType === "NOTE") {
                    const noteKind = String(structuredPayload?.["kind"] ?? "NOTE").toUpperCase();
                    const preview = String(structuredPayload?.["preview"] ?? "");
                    const noteBody = String(structuredPayload?.["note"] ?? title ?? "").trim();
                    const pinToTop = Boolean(structuredPayload?.["pinToTop"]);
                    const noteLabel = noteKind === "PIN_MESSAGE"
                        ? "Pinned message"
                        : noteKind === "UNPIN_MESSAGE"
                            ? "Unpinned message"
                            : noteKind === "BOARD_NOTE"
                                ? "Group note"
                                : "Shared note";
                    content = (
                        <div className="rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-lime-900">
                            <p className="text-xs font-semibold uppercase tracking-wide">{noteLabel}</p>
                            {noteBody && (
                                <p className="mt-1 whitespace-pre-wrap text-sm">{noteBody}</p>
                            )}
                            {(noteKind === "PIN_MESSAGE" || noteKind === "UNPIN_MESSAGE") && preview && (
                                <p className="mt-1 text-[11px] text-lime-800">{preview}</p>
                            )}
                            {noteKind === "BOARD_NOTE" && (
                                <p className="mt-1 text-[11px] text-lime-800">
                                    {pinToTop ? "Pinned to top" : "Note only"}
                                </p>
                            )}
                        </div>
                    );
                    break;
                }

                if (semanticType === "MEETING") {
                    content = (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-900">
                            <p className="text-xs font-semibold uppercase tracking-wide">Meeting</p>
                            <p className="mt-1 text-sm font-semibold">{title}</p>
                            {link && (
                                <a
                                    href={link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 block truncate text-xs font-semibold text-indigo-700 underline"
                                >
                                    {link}
                                </a>
                            )}
                        </div>
                    );
                    break;
                }
            }

            content = (
                <p className="whitespace-pre-wrap break-words [word-break:normal] text-sm leading-[1.4]">
                    {renderTextWithMentions(summarizeStructuredText(message.text) || message.text)}
                </p>
            );
            break;
    }
    }

    return (
        <>
            <div className={bubbleFrame}>
                {message.isForwarded && !isVisualMedia && (
                <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${isMine ? "text-indigo-100" : "text-indigo-600"}`}>
                    Forwarded
                </p>
                )}
                {message.replyPreviewText && !message.isRecalled && (
                    <div className={`mb-2 rounded-lg border px-2 py-1 text-[11px] ${isMine ? "border-indigo-200/60 bg-indigo-500/40 text-indigo-50" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        <p className="truncate">{summarizeStructuredText(message.replyPreviewText) || message.replyPreviewText}</p>
                    </div>
                )}
                {content}
                {message.isEdited && message.type === "text" && !message.isRecalled && (
                <p className={`mt-1 text-[10px] ${isMine ? "text-indigo-100" : "text-slate-500"}`}>
                    edited
                </p>
                )}
            </div>

            {isImagePreviewOpen && mediaUrl && (
                <div className="fixed inset-0 z-70 grid place-items-center bg-slate-950/85 p-4">
                    <div className="relative max-h-[92vh] w-full max-w-5xl">
                        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    void copyImageReference();
                                }}
                                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-700 hover:bg-white"
                                title="Copy"
                                aria-label="Copy"
                            >
                                <Copy size={17} />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void downloadMediaToDevice(mediaUrl, mediaFileName);
                                }}
                                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-700 hover:bg-white"
                                title="Download"
                                aria-label="Download"
                            >
                                <Download size={17} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsImagePreviewOpen(false)}
                                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-700 hover:bg-white"
                                title="Close"
                                aria-label="Close"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        <img
                            src={mediaUrl}
                            alt={mediaFileName}
                            className="max-h-[92vh] w-full rounded-2xl object-contain"
                        />

                        {mediaActionNote && (
                            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                                {mediaActionNote}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
