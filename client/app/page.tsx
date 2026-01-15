"use client";

import { useState } from "react";
import PdfSidebar, { Pdf } from "@/components/pdf-sidebar";
import UploadModal from "@/components/upload-modal";
import ChatScreen from "@/components/chat-component";
import { UserButton } from "@clerk/nextjs";

export default function Home() {
  const [selectedPdf, setSelectedPdf] = useState<Pdf | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectPdf = (pdf: Pdf) => {
    setSelectedPdf(pdf);
  };

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleNewChat = () => {
    setSelectedPdf(null);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 via-white to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-violet-950">
      {/* Header */}
      <header className="w-full px-8 py-6 border-b border-gray-200/50 dark:border-gray-800/50 backdrop-blur-sm bg-white/50 dark:bg-gray-950/50 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                Chat with PDF
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Upload and interact with your documents
              </p>
            </div>
          </div>

          {/* Right side: Status Indicator + User Button */}
          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            {selectedPdf && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Document Ready
                </span>
              </div>
            )}

            {/* User Profile Button */}
            <UserButton
              appearance={{
                elements: {
                  avatarBox:
                    "w-10 h-10 ring-2 ring-violet-500/20 ring-offset-2 ring-offset-white dark:ring-offset-gray-950",
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex p-4 gap-4 h-[calc(100vh-88px)]">
        {/* Left Panel - PDF Sidebar */}
        <div className="w-[30%] h-full">
          <div className="h-full bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col overflow-hidden">
            <PdfSidebar
              selectedPdfId={selectedPdf?.id || null}
              onSelectPdf={handleSelectPdf}
              onUploadNew={() => setIsUploadModalOpen(true)}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>

        {/* Right Panel - Chat */}
        <div className="w-[70%] h-full">
          <div className="h-full bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Chat
                </h2>
                {selectedPdf && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-full">
                    <svg
                      className="w-3 h-3 text-violet-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs font-medium text-violet-700 dark:text-violet-400 max-w-[200px] truncate">
                      {selectedPdf.originalName}
                    </span>
                  </div>
                )}
              </div>

              {selectedPdf && (
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  New Chat
                </button>
              )}
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-hidden">
              <ChatScreen
                isEnabled={!!selectedPdf}
                fileName={selectedPdf?.originalName}
                pdfId={selectedPdf?.id}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
