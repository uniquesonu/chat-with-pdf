"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_MAIN_API_URL;

interface Source {
  content: string;
  metadata: {
    source: string;
    filename: string;
    chunkIndex: number;
    uploadedAt: string;
    pdfId?: string;
    pdf?: {
      info?: {
        Title?: string;
      };
      totalPages?: number;
    };
    loc?: {
      pageNumber: number;
      lines?: {
        from: number;
        to: number;
      };
    };
  };
}

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  query?: string;
  sources?: Source[];
  timestamp: Date;
  isLoading?: boolean;
}

interface ChatScreenProps {
  isEnabled: boolean;
  fileName?: string;
  pdfId?: string;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  isEnabled,
  fileName,
  pdfId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set()
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEnabled]);

  // Clear messages when PDF changes
  useEffect(() => {
    setMessages([]);
    setExpandedSources(new Set());
  }, [pdfId]);

  const generateId = (): string => {
    return (
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    );
  };

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !isEnabled || isLoading || !pdfId) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      type: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: generateId(),
      type: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/chat`, {
        query: userMessage.content,
        pdfId: pdfId,
      });

      const { success, answer, sources, query } = response.data;

      if (success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id
              ? {
                  ...msg,
                  content: answer,
                  query,
                  sources,
                  isLoading: false,
                }
              : msg
          )
        );
      } else {
        throw new Error("Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      let errorMessage =
        "Sorry, I encountered an error while processing your question. Please try again.";

      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: errorMessage,
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMarkdown = (text: string) => {
    // Simple markdown formatting
    let formatted = text;

    // Bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Bullet points
    formatted = formatted.replace(/^\*\s+(.*)$/gm, '<li class="ml-4">$1</li>');
    formatted = formatted.replace(
      /(<li.*<\/li>)/s,
      '<ul class="list-disc space-y-1">$1</ul>'
    );

    // Line breaks
    formatted = formatted.replace(/\n\n/g, '</p><p class="mt-3">');
    formatted = formatted.replace(/\n/g, "<br/>");

    return `<p>${formatted}</p>`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            {isEnabled ? (
              <div className="text-center max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/30 animate-pulse">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                  Ready to Chat!
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Ask me anything about{" "}
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    {fileName}
                  </span>
                  . I'll search through the document and provide relevant
                  answers.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {["Key insights", "Main topics", "Summary"].map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() =>
                          setInputValue(
                            `What are the ${suggestion.toLowerCase()} of this document?`
                          )
                        }
                        className="px-4 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-gray-400 dark:text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  No Document Selected
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Select a PDF from the sidebar or upload a new one
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] ${
                    message.type === "user" ? "order-2" : "order-1"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex items-start gap-3 ${
                      message.type === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                        message.type === "user"
                          ? "bg-gradient-to-br from-violet-500 to-purple-600"
                          : "bg-gradient-to-br from-emerald-500 to-teal-600"
                      }`}
                    >
                      {message.type === "user" ? (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1">
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          message.type === "user"
                            ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {message.isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <span
                                className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0ms" }}
                              />
                              <span
                                className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                                style={{ animationDelay: "150ms" }}
                              />
                              <span
                                className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Searching and generating response...
                            </span>
                          </div>
                        ) : (
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{
                              __html: formatMarkdown(message.content),
                            }}
                          />
                        )}
                      </div>

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleSources(message.id)}
                            className="flex items-center gap-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform ${
                                expandedSources.has(message.id)
                                  ? "rotate-180"
                                  : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                            <span>
                              {message.sources.length} Source
                              {message.sources.length !== 1 ? "s" : ""} Found
                            </span>
                          </button>

                          {expandedSources.has(message.id) && (
                            <div className="mt-3 space-y-3">
                              {message.sources.map((source, idx) => (
                                <div
                                  key={idx}
                                  className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all hover:border-violet-300 dark:hover:border-violet-700"
                                >
                                  {/* Source Header */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                      <svg
                                        className="w-3 h-3 text-red-600 dark:text-red-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                                        {source.metadata.filename}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        {source.metadata.loc?.pageNumber && (
                                          <span className="flex items-center gap-1">
                                            <svg
                                              className="w-3 h-3"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                              />
                                            </svg>
                                            Page{" "}
                                            {source.metadata.loc.pageNumber}
                                          </span>
                                        )}
                                        {source.metadata.loc?.lines && (
                                          <span>
                                            Lines{" "}
                                            {source.metadata.loc.lines.from}-
                                            {source.metadata.loc.lines.to}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="px-2 py-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full">
                                      #{idx + 1}
                                    </span>
                                  </div>

                                  {/* Source Content */}
                                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                                    {source.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Timestamp */}
                      <p
                        className={`text-xs text-gray-400 dark:text-gray-500 mt-2 ${
                          message.type === "user" ? "text-right" : ""
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-t from-white dark:from-gray-900 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                isEnabled
                  ? "Ask a question about your PDF..."
                  : "Select a PDF first..."
              }
              disabled={!isEnabled || isLoading}
              className="w-full px-5 py-3.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-12"
            />
            {inputValue && (
              <button
                onClick={() => setInputValue("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!isEnabled || isLoading || !inputValue.trim()}
            className="px-6 py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium rounded-2xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
          AI responses are based on PDF content. Always verify important
          information.
        </p>
      </div>
    </div>
  );
};

export default ChatScreen;
