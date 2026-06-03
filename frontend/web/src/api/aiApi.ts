import { httpClient } from "./httpClient";
import { getAccessToken } from "../auth/token";

export interface ChatMessage {
  id: string;
  role: "user" | "model" | "bot"; // The backend returns "user" or "model", but UI might use "bot"
  content: string;
  timestamp: string;
}

export const aiApi = {
  chat: async (content: string): Promise<ChatMessage> => {
    const response = await httpClient.post<{ data: ChatMessage }>("/api/v1/ai/chat", { content });
    return response.data.data;
  },

  getHistory: async (): Promise<ChatMessage[]> => {
    const response = await httpClient.get<{ data: ChatMessage[] }>("/api/v1/ai/chat/history");
    return response.data.data;
  },
};
