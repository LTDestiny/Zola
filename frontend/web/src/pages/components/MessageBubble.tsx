import { Copy, Download, FileText, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChatMessage } from "./ChatMessage.types";

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

    const incomingTone = "bg-white text-slate-900 border border-slate-200";
    const outgoingTone = "bg-linear-to-br from-indigo-600 via-violet-600 to-blue-600 text-white";
    const recalledIncomingTone = "border border-amber-300 bg-amber-50 text-amber-800";
    const recalledOutgoingTone = "border border-amber-400 bg-amber-100 text-amber-900";
    const isVisualMedia = message.type === "image" || message.type === "video";

    const bubbleFrame = message.isRecalled
        ? `w-fit min-w-[44px] max-w-[82vw] lg:max-w-[62vw] rounded-2xl px-4 py-3 shadow-sm ${isMine ? recalledOutgoingTone : recalledIncomingTone}`
        : isVisualMedia
        ? "w-fit min-w-[44px] max-w-[82vw] lg:max-w-[62vw] overflow-hidden rounded-2xl shadow-sm"
        : `w-fit min-w-[44px] max-w-[82vw] lg:max-w-[62vw] rounded-2xl px-4 py-3 shadow-sm ${isMine ? outgoingTone : incomingTone}`;

    let content: React.ReactNode;

    const mediaUrl = message.mediaUrl;
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
            content = (
                <button
                    type="button"
                    onClick={() => setIsImagePreviewOpen(true)}
                    className="relative block overflow-hidden rounded-2xl"
                >
                    {isImageLoading && <div className="h-44 w-64 animate-pulse bg-slate-200" />}
                    <img
                        src={message.mediaUrl ?? "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200"}
                        alt={message.fileName ?? "image"}
                        className={`h-44 w-64 object-cover ${isImageLoading ? "hidden" : "block"}`}
                        onLoad={() => setIsImageLoading(false)}
                    />
                </button>
            );
            break;
        case "video":
            content = (
                <div className="relative overflow-hidden rounded-xl bg-slate-900">
                    <video className="h-48 w-72 object-cover" src={message.mediaUrl} preload="metadata" />
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
