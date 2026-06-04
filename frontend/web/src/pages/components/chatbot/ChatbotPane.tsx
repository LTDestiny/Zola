import { Bot, Send, User, Sparkles, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../../i18n/language";
import { aiApi, type ChatMessage } from "../../../api/aiApi";

const SUGGESTIONS = [
  { id: "suggest-1", textVi: "Tóm tắt tin nhắn", textEn: "Summarize messages" },
  { id: "suggest-2", textVi: "Lên ý tưởng cho cuộc hẹn", textEn: "Date ideas" },
  { id: "suggest-3", textVi: "Viết email xin nghỉ phép", textEn: "Write a leave email" },
];

export function ChatbotPane() {
  const { language } = useLanguage();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aiApi.getHistory().then((history) => {
      if (history.length === 0) {
        setMessages([
          {
            id: "welcome",
            role: "model",
            content: language === "vi" 
              ? "Xin chào! Tôi là Zola AI. Tôi có thể giúp gì cho bạn hôm nay?" 
              : "Hello! I am Zola AI. How can I help you today?",
            timestamp: new Date().toISOString()
          }
        ]);
      } else {
        setMessages(history);
      }
    }).catch(console.error);
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInput("");
    setIsLoading(true);
    
    try {
      const response = await aiApi.chat(text.trim());
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error(error);
      const errorMsgId = (Date.now() + 1).toString();
      setMessages(prev => [
        ...prev,
        {
          id: errorMsgId,
          role: "model",
          content: language === "vi" ? "Đã có lỗi xảy ra." : "An error occurred.",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (isLoading) return;
    try {
      await aiApi.clearHistory();
      setMessages([
        {
          id: "welcome",
          role: "model",
          content: language === "vi" 
            ? "Xin chào! Tôi là Zola AI. Tôi có thể giúp gì cho bạn hôm nay?" 
            : "Hello! I am Zola AI. How can I help you today?",
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0b0f17] text-slate-100">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#121822] px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">Zola AI</h2>
            <p className="text-xs text-indigo-300">
              {language === "vi" ? "Trợ lý ảo thông minh" : "Smart Assistant"}
            </p>
          </div>
        </div>
        <button
          onClick={handleClear}
          disabled={isLoading || messages.length <= 1}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-red-400 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          title={language === "vi" ? "Xóa lịch sử" : "Clear history"}
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
        <div className="mx-auto max-w-4xl space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                (msg.role === "bot" || msg.role === "model")
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "bg-slate-800 text-slate-300"
              }`}>
                {(msg.role === "bot" || msg.role === "model") ? <Bot size={20} /> : <User size={20} />}
              </div>
              
              {/* Bubble */}
              <div className={`flex max-w-[85%] flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-[#18202f] text-slate-200 border border-white/5"
                }`}>
                  {msg.content}
                </div>
                <span className="mt-1.5 px-1 text-[11px] font-medium text-slate-500">
                  {new Date(msg.timestamp).toLocaleTimeString(language === "vi" ? "vi-VN" : "en-US", { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-purple-500/20">
                <Bot size={20} />
              </div>
              <div className="flex items-center rounded-2xl bg-[#18202f] border border-white/5 px-5 py-3.5">
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }}></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }}></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-white/5 bg-[#121822] p-4">
        {/* Suggested Questions */}
        {messages.length <= 2 && (
          <div className="mx-auto mb-4 flex max-w-4xl flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSend(language === "vi" ? s.textVi : s.textEn)}
                disabled={isLoading}
                className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300 transition-colors hover:bg-indigo-500/20 disabled:opacity-50"
              >
                {language === "vi" ? s.textVi : s.textEn}
              </button>
            ))}
          </div>
        )}

        <div className={`mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-white/10 bg-[#0b0f17] p-2 transition-colors ${isLoading ? "opacity-50 pointer-events-none" : "focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)]"}`}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder={language === "vi" ? "Hỏi Zola AI bất cứ điều gì..." : "Ask Zola AI anything..."}
            className="max-h-32 min-h-[44px] w-full resize-none bg-transparent px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none scrollbar-hide disabled:opacity-50"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
            className="mb-1 mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
          >
            <Send size={18} className={input.trim() ? "translate-x-[1px]" : ""} />
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          Zola AI can make mistakes. Consider verifying important information.
        </p>
      </div>
    </div>
  );
}
