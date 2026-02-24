import { useState, useRef, useEffect } from "react";
import { Link } from "react-router"; // Note: In newer React Router, this is usually 'react-router-dom'
import { Heart, Send, Mic, AlertTriangle, Shield, ChevronLeft, Volume2 } from "lucide-react";

export default function Chat() {
  // 1. Cleaned up initial messages to just a single welcome prompt
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
  
  // 2. Added a loading state so the user knows the AI is thinking
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 3. Upgraded to async function to talk to your real Python backend
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
      // 4. Send the question to your local FastAPI server!
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
        type: "error", // Using your safety alert UI for errors
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
      // Simulate voice recording for now (you can hook this up to your voice API later!)
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
    <div className="min-h-screen bg-[#D3D0BC] flex flex-col">
      {/* Header */}
      <header className="bg-[#3E435D] px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-[#D3D0BC]">
              <ChevronLeft className="w-7 h-7" />
            </Link>
            <Heart className="w-7 h-7 text-[#CBC3A5]" />
            <div>
              <h1 className="text-[#D3D0BC] text-lg font-semibold">AI Recovery Assistant</h1>
              <p className="text-[#9AA7B1] text-sm">Always here to help</p>
            </div>
          </div>
          <button className="text-[#D3D0BC]">
            <Volume2 className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Safety Notice */}
      <div className="bg-[#3E435D] px-4 py-3 border-t border-[#D3D0BC]/20">
        <div className="max-w-4xl mx-auto flex items-start gap-2">
          <Shield className="w-5 h-5 text-[#CBC3A5] shrink-0 mt-0.5" />
          <p className="text-[#9AA7B1] text-sm">
            AI suggestions are educational only. For medical emergencies, call 911 or your healthcare provider.
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => {
            if (message.type === "user") {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="bg-[#9AA7B1] text-white rounded-2xl rounded-tr-sm px-5 py-4 max-w-[85%] shadow-sm">
                    <p className="text-lg leading-relaxed">{message.content}</p>
                    <p className="text-xs text-white/70 mt-2">
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            } else if (message.type === "ai") {
              return (
                <div key={message.id} className="flex justify-start">
                  <div className="bg-[#CBC3A5] text-[#3E435D] rounded-2xl rounded-tl-sm px-5 py-4 max-w-[85%] shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-[#3E435D] rounded-full"></div>
                      <span className="text-sm font-semibold">AI Assistant</span>
                    </div>
                    <p className="text-lg leading-relaxed whitespace-pre-line">{message.content}</p>
                    <p className="text-xs text-[#3E435D]/60 mt-2">
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            } else {
              return (
                <div key={message.id} className="flex justify-center">
                  <div className="bg-[#3E435D] border-2 border-[#3E435D] text-[#D3D0BC] rounded-2xl px-5 py-4 max-w-[90%] shadow-md">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-[#CBC3A5] shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold mb-2">⚠️ Alert</p>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#CBC3A5] text-[#3E435D] rounded-2xl rounded-tl-sm px-5 py-4 max-w-[85%] shadow-sm opacity-70 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#3E435D] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#3E435D] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-[#3E435D] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Question Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#3E435D] text-sm font-medium mb-3">Ask about the document:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInputValue(question)}
                  className="bg-white text-[#3E435D] px-4 py-2 rounded-full text-sm border border-[#3E435D]/20 hover:bg-[#3E435D] hover:text-[#D3D0BC] transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white px-4 py-4 border-t border-[#3E435D]/20 sticky bottom-0">
        <div className="max-w-4xl mx-auto flex gap-3 items-end">
          <div className="flex-1 bg-[#D3D0BC] rounded-2xl px-4 py-3 flex items-center gap-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about the medical record..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-[#3E435D] placeholder:text-[#9AA7B1] resize-none outline-none text-lg min-h-7 max-h-32 disabled:opacity-50"
              rows={1}
              style={{ 
                height: 'auto',
                minHeight: '28px'
              }}
              onInput={(e) => {
                const target = e.target;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-[#3E435D] text-[#D3D0BC] p-3 rounded-xl hover:bg-[#4a5070] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <button
            onClick={toggleRecording}
            disabled={isLoading}
            className={`p-4 rounded-2xl transition-all shrink-0 ${
              isRecording
                ? "bg-[#d4183d] text-white animate-pulse"
                : "bg-[#3E435D] text-[#D3D0BC] hover:bg-[#4a5070] disabled:opacity-50"
            }`}
          >
            <Mic className="w-7 h-7" />
          </button>
        </div>
        
        {isRecording && (
          <div className="max-w-4xl mx-auto mt-3">
            <div className="bg-[#d4183d]/10 text-[#d4183d] px-4 py-2 rounded-xl text-center">
              <p className="text-sm font-medium">🎤 Listening... Tap to stop</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}