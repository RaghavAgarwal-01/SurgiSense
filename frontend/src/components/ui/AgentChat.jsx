import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Loader2, Bot, User } from "lucide-react";
import axios from "axios";
import ReasoningChain from "./ReasoningChain";
import ReactMarkdown from "react-markdown";

const API_BASE = "http://localhost:8000";
const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export default function AgentChat({ onTaskCompleted }) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "agent",
      content: "Hi! I'm your SurgiSense Agent. I can help you complete tasks, check your medication inventory, or summarize your adherence. How can I help today?",
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    const userMsg = { id: Date.now().toString(), role: "user", content: inputMessage.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const res = await axios.post(
        `${API_BASE}/api/agent/chat`,
        { message: userMsg.content },
        getAuthHeaders()
      );

      const agentData = res.data;
      const agentMsg = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: agentData.response || "I couldn't process that request right now.",
        reasoningChain: agentData.reasoning_chain || [],
      };

      setMessages((prev) => [...prev, agentMsg]);

      // If a task was completed, we notify the parent so it can refresh the UI
      if (agentData.intent === "complete_task" && agentData.agent_result?.status === "success") {
        if (onTaskCompleted) onTaskCompleted();
      }

    } catch (err) {
      console.error("Agent chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: "Sorry, I ran into an error trying to process your request. Please try again later.",
          isError: true,
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#3E435D]/5 flex flex-col h-[450px] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#3E435D]/5 flex items-center gap-3 bg-white/50">
        <div className="w-10 h-10 bg-[#3E435D] flex items-center justify-center rounded-xl">
          <Bot className="w-5 h-5 text-[#CBC3A5]" />
        </div>
        <div>
          <h2 className="text-[#3E435D] text-[15px] font-bold leading-tight">SurgiSense Agent</h2>
          <p className="text-[#9AA7B1] text-xs">Always here to help</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === "user" ? "bg-[#CBC3A5] text-[#3E435D]" : "bg-[#3E435D] text-[#CBC3A5]"
              }`}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Bubble & Reasoning */}
              <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm prose prose-sm prose-p:my-1 prose-strong:text-current prose-a:text-blue-600 hover:prose-a:underline max-w-none ${
                  msg.role === "user" 
                    ? "bg-[#3E435D] text-white rounded-tr-sm" 
                    : msg.isError 
                      ? "bg-red-50 text-red-800 border border-red-200 rounded-tl-sm"
                      : "bg-white text-[#3E435D] border border-gray-100 rounded-tl-sm"
                }`}>
                  <ReactMarkdown>
                    {msg.content}
                  </ReactMarkdown>
                </div>
                
                {/* Reasoning Chain */}
                {msg.reasoningChain && msg.reasoningChain.length > 0 && (
                  <div className="w-full mt-1">
                    <ReasoningChain chain={msg.reasoningChain} visible={true} />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#3E435D] text-[#CBC3A5] flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3.5 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm flex gap-1.5 items-center">
                <motion.div 
                  className="w-1.5 h-1.5 rounded-full bg-[#9AA7B1]" 
                  animate={{ y: [0, -4, 0] }} 
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} 
                />
                <motion.div 
                  className="w-1.5 h-1.5 rounded-full bg-[#9AA7B1]" 
                  animate={{ y: [0, -4, 0] }} 
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} 
                />
                <motion.div 
                  className="w-1.5 h-1.5 rounded-full bg-[#9AA7B1]" 
                  animate={{ y: [0, -4, 0] }} 
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white/50 border-t border-[#3E435D]/5">
        <form 
          onSubmit={handleSendMessage}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isTyping}
            placeholder={isTyping ? "Agent is thinking..." : "Message agent... (e.g. 'I took my meds')"}
            className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-12 py-3.5 text-sm text-[#3E435D] placeholder:text-gray-400 focus:outline-none focus:border-[#3E435D]/30 focus:ring-2 focus:ring-[#3E435D]/5 transition-all disabled:opacity-50 disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isTyping}
            className="absolute right-2 p-2 bg-[#CBC3A5] hover:bg-[#b5af94] text-[#3E435D] rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-[#CBC3A5]"
          >
            {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
