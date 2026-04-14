import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { httpClient } from "./httpClient";
import type { ApiResponse, MessageType } from "@/shared/types/api";

export type UploadedMedia = {
  key: string;
  fileUrl: string;
  fileName: string;
  size: number;
  contentType: string;
  mediaType: "IMAGE" | "VIDEO" | "FILE";
};

export async function pickMediaFromLibrary() {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: false,
    mediaTypes: ["images", "videos"],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export async function pickDocumentFile() {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export async function uploadMedia(input: {
  uri: string;
  name: string;
  mimeType: string;
}) {
  const formData = new FormData();
  formData.append("file", {
    uri: input.uri,
    name: input.name,
    type: input.mimeType,
  } as unknown as Blob);

  const response = await httpClient.post<ApiResponse<UploadedMedia>>("/api/v1/media/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export function inferMessageType(contentType: string): MessageType {
  if (contentType.startsWith("image/")) return "IMAGE";
  if (contentType.startsWith("video/")) return "VIDEO";
  if (contentType.startsWith("audio/")) return "AUDIO";
  return "FILE";
}
