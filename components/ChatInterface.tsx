import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { sendChatMessage } from '../services/gemini';
import { Remarkable } from 'remarkable';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const md = new Remarkable();

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, setMessages }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await sendChatMessage(input);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: '抱歉，遇到错误。请重试。',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Command (Mac) or Control (Windows) + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
    // Default 'Enter' behavior (insert new line) is preserved
  };

  const handleDownloadChat = () => {
    if (messages.length === 0) return;
    
    const content = messages.map(m => {
      const time = new Date(m.timestamp).toLocaleTimeString();
      const role = m.role === 'user' ? '用户' : 'AI 助教';
      return `[${time}] ${role}:\n${m.text}\n-------------------`;
    }).join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market_insight_chat_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-700/50 shadow-xl">
      <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <h3 className="font-semibold text-slate-200 text-sm">AI 投资助教</h3>
        </div>
        <button 
          onClick={handleDownloadChat}
          disabled={messages.length === 0}
          title="下载聊天记录"
          className="text-slate-500 hover:text-white transition-colors disabled:opacity-30"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/40">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-3 p-4">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
            </div>
            <p className="text-sm">对分析有疑问？<br/>随时向我提问。</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <span className="text-[10px] text-slate-500 mb-1 px-1">
                {msg.role === 'user' ? '我' : 'AI 助教'}
            </span>
            <div
              className={`max-w-[95%] rounded-2xl p-3 text-sm leading-relaxed shadow-md whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-slate-700 text-slate-200 rounded-tl-none'
              }`}
            >
               {msg.role === 'model' ? (
                 <div 
                   className="prose prose-invert prose-xs max-w-none prose-p:my-1 prose-headings:mb-1 prose-headings:mt-2"
                   dangerouslySetInnerHTML={{ __html: md.render(msg.text) }} 
                 />
               ) : (
                 msg.text
               )}
            </div>
          </div>
        ))}
        {loading && (
           <div className="flex justify-start">
             <div className="bg-slate-700 rounded-2xl rounded-tl-none p-3 flex gap-2 items-center shadow-md">
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></div>
               <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-slate-800/50 border-t border-slate-700 backdrop-blur-sm flex-shrink-0">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题... (按 Enter 换行，Command+Enter 发送)"
            className="w-full bg-slate-900/80 border border-slate-600/50 rounded-xl py-3 pl-3 pr-10 text-xs text-white focus:outline-none focus:border-blue-500 resize-none h-24 custom-scrollbar focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            title="发送 (Command + Enter)"
            className="absolute right-2 bottom-2 p-2 text-blue-500 hover:text-blue-400 disabled:text-slate-700 transition-colors bg-slate-800/80 rounded-lg hover:bg-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
        <div className="text-[10px] text-slate-600 text-center mt-1">
          按 <span className="font-mono bg-slate-800 px-1 rounded">Cmd/Ctrl + Enter</span> 发送
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;