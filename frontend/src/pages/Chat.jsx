import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, Send, Mic, AlertTriangle, Shield, ChevronLeft, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      id: "1",
      type: "ai",
      content: "Hello! I'm your SurgiSense Clinical Assistant. I have analyzed your medical document. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const userText = inputValue;
    const userMessage = {
      id: Date.now().toString(),
      type: "user",
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: data.answer,
          timestamp: new Date(),
        }]);
      } else {
        throw new Error("Backend returned an error");
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        type: "error",
        content: "Network error. Please make sure your FastAPI backend is running and you have scanned a document.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
        setInputValue("Can I start putting more weight on my leg?");
      }, 2000);
    }
  };

  const exampleQuestions = [
    "What medications was the patient prescribed?",
    "Are there any pre-op restrictions?",
    "What is the surgery date?",
    "What type of surgery was performed?",
  ];

  return (
    <div className="h-screen bg-[#D3D0BC] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#3E435D]/95 backdrop-blur-md px-5 py-3 border-b border-white/5 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-[#D3D0BC] hover:bg-white/10 p-1.5 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 bg-[#CBC3A5] rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#3E435D]" />
            </div>
            <div>
              <h1 className="text-[#D3D0BC] text-base font-semibold leading-tight">AI Recovery Assistant</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <p className="text-[#9AA7B1] text-xs">Online · RAG-enabled</p>
              </div>
            </div>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="max-w-4xl mx-auto flex items-center gap-2 mt-2 bg-white/5 rounded-lg px-3 py-1.5">
          <Shield className="w-3.5 h-3.5 text-[#CBC3A5] shrink-0" />
          <p className="text-[#9AA7B1] text-[11px]">
            AI suggestions are educational only. For emergencies, call 911.
          </p>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-4xl mx-auto space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {message.type === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-[#3E435D] text-[#D3D0BC] rounded-2xl rounded-br-md px-4 py-3 max-w-[80%] shadow-sm">
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p className="text-[10px] text-[#D3D0BC]/50 mt-1.5 text-right">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ) : message.type === "ai" ? (
                  <div className="flex justify-start gap-2.5">
                    <div className="w-7 h-7 bg-[#CBC3A5] rounded-lg flex items-center justify-center shrink-0 mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#3E435D]" />
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm text-[#3E435D] rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%] border border-[#3E435D]/5 shadow-sm">
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:text-[#3E435D] prose-strong:text-[#3E435D]">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      <p className="text-[10px] text-[#9AA7B1] mt-1.5">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="bg-[#d4183d]/10 border border-[#d4183d]/20 text-[#d4183d] rounded-xl px-4 py-3 max-w-[85%]">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p className="text-sm leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading Indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start gap-2.5"
            >
              <div className="w-7 h-7 bg-[#CBC3A5] rounded-lg flex items-center justify-center shrink-0 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-[#3E435D]" />
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl rounded-tl-md px-5 py-4 border border-[#3E435D]/5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#3E435D]/40 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-[#3E435D]/40 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-2 h-2 bg-[#3E435D]/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 shrink-0">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#3E435D]/60 text-xs font-medium mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInputValue(question)}
                  className="bg-white/70 backdrop-blur-sm text-[#3E435D] px-3 py-1.5 rounded-full text-xs font-medium border border-[#3E435D]/10 hover:bg-[#3E435D] hover:text-[#D3D0BC] transition-all duration-200"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white/90 backdrop-blur-md px-4 py-3 border-t border-[#3E435D]/10 shrink-0">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          <div className="flex-1 bg-[#D3D0BC]/30 rounded-xl px-4 py-2.5 flex items-center gap-2 border border-[#3E435D]/5 focus-within:border-[#3E435D]/20 transition-colors">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about the medical record..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-[#3E435D] placeholder:text-[#9AA7B1] resize-none outline-none text-sm min-h-6 max-h-28 disabled:opacity-50"
              rows={1}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-[#3E435D] text-[#D3D0BC] p-2 rounded-lg hover:bg-[#4a5070] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={toggleRecording}
            disabled={isLoading}
            className={`p-3 rounded-xl transition-all shrink-0 ${
              isRecording
                ? "bg-[#d4183d] text-white shadow-lg shadow-[#d4183d]/30 animate-pulse"
                : "bg-[#3E435D] text-[#D3D0BC] hover:bg-[#4a5070] disabled:opacity-50"
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>

        {isRecording && (
          <div className="max-w-4xl mx-auto mt-2">
            <div className="bg-[#d4183d]/10 text-[#d4183d] px-3 py-1.5 rounded-lg text-center">
              <p className="text-xs font-medium">Listening... Tap mic to stop</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}