import type { AxiosProgressEvent } from "axios";
import { httpClient } from "./httpClient";

type ApiResponse<T> = {
    success: boolean;
    message: string;
    data: T;
};

export type UploadedMedia = {
    key: string;
    fileUrl: string;
    fileName: string;
    size: number;
    contentType: string;
    mediaType: "IMAGE" | "VIDEO" | "FILE";
};

export type UploadMediaOptions = {
    signal?: AbortSignal;
    onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
};

export async function uploadMedia(file: File, options?: UploadMediaOptions) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await httpClient.post<ApiResponse<UploadedMedia>>(
        "/api/v1/media/upload",
        formData,
        {
            signal: options?.signal,
            headers: {
                "Content-Type": "multipart/form-data",
            },
            onUploadProgress: (event: AxiosProgressEvent) => {
                const loaded = event.loaded ?? 0;
                const total = event.total ?? file.size;
                const safeTotal = total > 0 ? total : file.size;
                const percent = safeTotal > 0 ? Math.min(100, Math.round((loaded / safeTotal) * 100)) : 0;
                options?.onProgress?.(percent, loaded, safeTotal);
            },
        },
    );

    return response.data;
}
