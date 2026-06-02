import { Bot, Send, User, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../../../i18n/language";

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: string;
}

const MOCK_HISTORY: ChatMessage[] = [
  {
    id: "1",
    role: "bot",
    content: "Xin chào! Tôi là Zola AI. Tôi có thể giúp gì cho bạn hôm nay?",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "2",
    role: "user",
    content: "Zola AI có thể làm được những gì?",
    timestamp: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    id: "3",
    role: "bot",
    content: "Tôi có thể giúp bạn viết email, tóm tắt tin nhắn, lên ý tưởng, hoặc chỉ đơn giản là trò chuyện cùng bạn. Ngoài ra, tôi đang được tích hợp sâu vào Zola để giúp bạn quản lý công việc và giao tiếp tốt hơn!",
    timestamp: new Date(Date.now() - 3400000).toISOString(),
  }
];

export function ChatbotPane() {
  const { language } = useLanguage();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_HISTORY);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInput("");
    
    // Mock bot response
    setTimeout(() => {
      const newBotMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: language === "vi" 
          ? "Tính năng này đang trong giai đoạn thử nghiệm (Mock data). Cảm ơn bạn đã trải nghiệm!"
          : "This feature is currently in testing (Mock data). Thanks for trying it out!",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, newBotMsg]);
    }, 1000);
  };

  return (
    <div className="flex h-full flex-col bg-[#0b0f17] text-slate-100">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/5 bg-[#121822] px-6 py-4 shadow-sm">
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

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
        <div className="mx-auto max-w-4xl space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                msg.role === "bot" 
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "bg-slate-800 text-slate-300"
              }`}>
                {msg.role === "bot" ? <Bot size={20} /> : <User size={20} />}
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
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-white/5 bg-[#121822] p-4">
        <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-white/10 bg-[#0b0f17] p-2 transition-colors focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={language === "vi" ? "Hỏi Zola AI bất cứ điều gì..." : "Ask Zola AI anything..."}
            className="max-h-32 min-h-[44px] w-full resize-none bg-transparent px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none scrollbar-hide"
            rows={1}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
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
