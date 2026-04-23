import axios from "axios";
import type { AxiosProgressEvent } from "axios";
import { httpClient } from "./httpClient";

type ApiResponse<T> = {
    success: boolean;
    message: string;
    data: T;
};

/** Item returned by the presigned-URL endpoint (Step 1). */
export type PresignedUrlItem = {
    fileName: string;
    fileKey: string;
    /** PUT this URL to upload directly to S3 (valid for 15 minutes). */
    uploadUrl: string;
    /** Public URL to embed in the chat message. */
    publicUrl: string;
};

export type UploadToS3Options = {
    signal?: AbortSignal;
    onProgress?: (percent: number) => void;
};

/**
 * Step 1 — Request presigned S3 upload URLs for up to 10 files.
 * Returns one PresignedUrlItem per file in the same order.
 */
export async function requestPresignedUrls(
    files: Array<{ fileName: string; contentType: string; sizeBytes: number }>,
): Promise<PresignedUrlItem[]> {
    const response = await httpClient.post<ApiResponse<{ items: PresignedUrlItem[] }>>(
        "/api/v1/media/presigned-urls",
        { files },
    );
    return response.data.data.items;
}

/**
 * Step 2 — Upload a single file directly to S3 using a presigned URL.
 * Content-Type MUST match exactly what was declared in requestPresignedUrls.
 */
export async function uploadFileToS3(
    file: File,
    item: PresignedUrlItem,
    options?: UploadToS3Options,
): Promise<void> {
    await axios.put(item.uploadUrl, file, {
        headers: { "Content-Type": file.type },
        signal: options?.signal,
        onUploadProgress: (event: AxiosProgressEvent) => {
            const loaded = event.loaded ?? 0;
            const total = event.total ?? file.size;
            const safeTotal = total > 0 ? total : file.size;
            const percent = safeTotal > 0 ? Math.min(100, Math.round((loaded / safeTotal) * 100)) : 0;
            options?.onProgress?.(percent);
        },
    });
}

/**
 * Delete an uploaded file from S3 (call when user cancels before sending).
 * Files are auto-cleaned by the backend after 2 hours even without this.
 */
export async function deleteUploadedFile(fileKey: string): Promise<void> {
    await httpClient.delete("/api/v1/media", { params: { fileKey } });
}

/** Map a MIME type to the mediaType enum expected by the backend. */
export function resolveMediaType(contentType: string): "IMAGE" | "VIDEO" | "FILE" {
    if (contentType.startsWith("image/")) return "IMAGE";
    if (contentType.startsWith("video/")) return "VIDEO";
    return "FILE";
}
