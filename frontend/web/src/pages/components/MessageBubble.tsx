import { FileText, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChatMessage } from "./ChatMessage.types";

type MessageBubbleProps = {
    message: ChatMessage;
    isMine: boolean;
};

function formatDuration(value?: string) {
    return value || "00:30";
}

export function MessageBubble({ message, isMine }: MessageBubbleProps) {
    const [isImageLoading, setIsImageLoading] = useState(message.type === "image");
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [audioProgress, setAudioProgress] = useState(25);

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

    const bubbleFrame = `w-fit min-w-[44px] max-w-[82vw] lg:max-w-[62vw] rounded-2xl px-4 py-3 shadow-sm ${isMine ? outgoingTone : incomingTone}`;

    let content: React.ReactNode;

    switch (message.type) {
        case "image":
            content = (
                <div className="relative overflow-hidden rounded-xl">
                    {isImageLoading && <div className="h-44 w-64 animate-pulse bg-slate-200" />}
                    <img
                        src={message.mediaUrl ?? "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200"}
                        alt={message.fileName ?? "image"}
                        className={`h-44 w-64 object-cover ${isImageLoading ? "hidden" : "block"}`}
                        onLoad={() => setIsImageLoading(false)}
                    />
                </div>
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
                    <a
                        href={message.mediaUrl}
                        download
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100"
                    >
                        Download
                    </a>
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
                    {message.text}
                </p>
            );
            break;
    }

    return (
        <div className={bubbleFrame}>
            {message.isForwarded && (
                <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${isMine ? "text-indigo-100" : "text-indigo-600"}`}>
                    Forwarded
                </p>
            )}
            {content}
        </div>
    );
}
