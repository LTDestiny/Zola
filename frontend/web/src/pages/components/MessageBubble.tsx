import { Copy, Download, FileText, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChatMessage } from "./ChatMessage.types";
import { resolveMediaUrl } from "../utils/mediaUrl";

type MessageBubbleProps = {
    message: ChatMessage;
    isMine: boolean;
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

function parseStructuredPayload(raw: string) {
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        return parsed as {
            title?: string;
            link?: string;
            createdAt?: string;
        };
    } catch {
        return null;
    }
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

export function MessageBubble({ message, isMine }: MessageBubbleProps) {
    const [isImageLoading, setIsImageLoading] = useState(message.type === "image");
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [audioProgress, setAudioProgress] = useState(25);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [mediaActionNote, setMediaActionNote] = useState<string | null>(null);

    useEffect(() => {
        setIsImageLoading(message.type === "image");
    }, [message.id, message.type]);

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
        ? `w-fit min-w-[44px] max-w-[82vw] lg:max-w-[62vw] rounded-2xl px-4 py-3 shadow-sm ${isMine ? recalledOutgoingTone : recalledIncomingTone}`
        : isVisualMedia
        ? "w-fit min-w-[44px] max-w-[82vw] lg:max-w-[62vw] overflow-hidden rounded-2xl shadow-sm"
        : `w-fit min-w-[44px] max-w-[82vw] lg:max-w-[62vw] rounded-2xl px-4 py-3 shadow-sm ${isMine ? outgoingTone : incomingTone}`;

    let content: React.ReactNode;

    const mediaUrl = resolveMediaUrl(message.mediaUrl);
    const mediaFileName = message.fileName ?? (message.type === "image" ? "image.jpg" : message.type === "video" ? "video.mp4" : "attachment");

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
                {message.text}
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
                    {isImageLoading && <div className="h-44 w-64 animate-pulse bg-slate-200" />}
                    <img
                        src={mediaUrl}
                        alt={message.fileName ?? "image"}
                        className={`h-44 w-64 object-cover ${isImageLoading ? "hidden" : "block"}`}
                        onLoad={() => setIsImageLoading(false)}
                        onError={() => {
                            setIsImageLoading(false);
                            setMediaActionNote("Image preview failed");
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
                    <video className="h-48 w-72 object-cover" src={mediaUrl} preload="metadata" />
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
                            <p className="text-xs text-slate-500">{message.fileSize ?? "1.2 MB"}</p>
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
                const title = structuredPayload?.title ?? message.text;
                const link = structuredPayload?.link;

                if (semanticType === "STICKER") {
                    content = (
                        <div className="text-4xl leading-none">{title || "😀"}</div>
                    );
                    break;
                }

                if (semanticType === "GIF") {
                    const gifUrl = link ?? title;
                    const isHttp = /^https?:\/\//i.test(gifUrl ?? "");
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
                    content = (
                        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
                            <p className="text-xs font-semibold uppercase tracking-wide">Poll</p>
                            <p className="mt-1 text-sm font-medium">{title}</p>
                        </div>
                    );
                    break;
                }

                if (semanticType === "REMINDER") {
                    content = (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                            <p className="text-xs font-semibold uppercase tracking-wide">Reminder</p>
                            <p className="mt-1 text-sm font-medium">{title}</p>
                        </div>
                    );
                    break;
                }

                if (semanticType === "NOTE") {
                    content = (
                        <div className="rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-lime-900">
                            <p className="text-xs font-semibold uppercase tracking-wide">Shared note</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{title}</p>
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
                <p className="max-w-full whitespace-pre-wrap wrap-break-word [word-break:break-word] text-sm leading-relaxed">
                    {renderTextWithMentions(message.text)}
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
                        <p className="truncate">{message.replyPreviewText}</p>
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
