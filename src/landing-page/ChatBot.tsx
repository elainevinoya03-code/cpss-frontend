import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

interface Message {
  text: string;
  isBot: boolean;
}

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { text: 'Hello! How can I help you today?', isBot: true },
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
    setIsOpen((open) => !open);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: Message = { text: inputValue, isBot: false };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    setTimeout(() => {
      const botMessage: Message = {
        text: 'Thank you for your message. Our team will get back to you shortly.',
        isBot: true,
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 1000);
  };

  return (
    <div className={cn('fixed bottom-5 right-5 z-[80]', isOpen ? 'flex flex-col items-end gap-4' : '')}>
      {isOpen && (
        <div className="animate-rise flex w-[min(340px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-display text-sm font-extrabold">CPSS Assistant</span>
            </div>
            <Button variant="icon" size="icon-sm" onClick={toggleChat} aria-label="Close chat">
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex h-72 flex-col gap-3 overflow-y-auto p-5" id="chatMessages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-5',
                  message.isBot
                    ? 'self-start rounded-bl-md bg-muted text-foreground'
                    : 'self-end rounded-br-md bg-primary text-primary-foreground',
                )}
              >
                {message.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="flex items-center gap-2 border-t border-border p-4" id="chatForm" onSubmit={handleSubmit}>
            <div className="flex-1 rounded-2xl border border-border bg-muted px-4 py-2 transition-colors focus-within:border-primary/50">
              <input
                id="chatInput"
                type="text"
                className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
                placeholder="Type a message..."
                autoComplete="off"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>
            <Button type="submit" variant="icon" size="icon" aria-label="Send message">
              <Send className="size-5" aria-hidden="true" />
            </Button>
          </form>
        </div>
      )}

      <Button
        variant="icon"
        className="size-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 hover:bg-primary/90 hover:rotate-6"
        onClick={toggleChat}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="size-6" aria-hidden="true" /> : <MessageCircle className="size-6" aria-hidden="true" />}
      </Button>
    </div>
  );
};

export default ChatBot;