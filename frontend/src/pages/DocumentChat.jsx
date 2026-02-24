import React, { useState } from 'react';

export default function DocumentChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I have analyzed the patient document. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user question to UI instantly
    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send question to your FastAPI backend
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Could not retrieve answer.' }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Is the backend running?' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-125 w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
      {/* Header */}
      <div className="bg-blue-900 text-white p-4 font-semibold text-lg flex items-center justify-between">
        <span>Clinical AI Assistant</span>
        <span className="text-xs bg-blue-700 px-2 py-1 rounded-full">SurgiSense</span>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-none px-4 py-3 text-sm shadow-sm animate-pulse">
              Analyzing document...
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about medications, history, restrictions..."
          className="flex-1 bg-slate-100 border-none focus:ring-2 focus:ring-blue-500 rounded-lg px-4 py-2 text-sm outline-none transition-all"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Send
        </button>
      </form>
    </div>
  );
}