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

export async function uploadMedia(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await httpClient.post<ApiResponse<UploadedMedia>>(
    "/api/v1/media/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
}
