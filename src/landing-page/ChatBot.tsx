import React, { useState, useEffect, useRef } from 'react';

interface Message {
  text: string;
  isBot: boolean;
}

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hello! How can I help you today?", isBot: true }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: Message = { text: inputValue, isBot: false };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate bot response
    setTimeout(() => {
      const botMessage: Message = { 
        text: "Thank you for your message. Our team will get back to you shortly.", 
        isBot: true 
      };
      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  return (
    <div className={`chat-bot ${isOpen ? 'chat-open' : ''}`} id="chatBot">
      <button 
        className="chat-toggle" 
        id="chatToggle" 
        aria-label="Open chat"
        onClick={toggleChat}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <div className="chat-panel" id="chatPanel">
        <div className="chat-header">
          <span className="chat-header-title">
            <span className="chat-header-status" aria-hidden="true"></span> CPSS Assistant
          </span>
          <button 
            className="chat-close" 
            id="chatClose" 
            aria-label="Close chat"
            onClick={toggleChat}
          >
            &times;
          </button>
        </div>
        <div className="chat-messages" id="chatMessages">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`chat-msg ${message.isBot ? 'chat-msg--bot' : 'chat-msg--user'}`}
            >
              {message.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-form" id="chatForm" onSubmit={handleSubmit}>
          <input 
            className="chat-input" 
            id="chatInput" 
            type="text" 
            placeholder="Type a message..." 
            autoComplete="off"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button className="chat-send" type="submit" aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatBot;