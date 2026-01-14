"use client";

import { useState } from "react";
import Upload from "@/components/upload";

interface UploadResponse {
  success: boolean;
  message: string;
  file: {
    filename: string;
    originalname: string;
    size: number;
    path: string;
  };
}

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [serverFile, setServerFile] = useState<UploadResponse["file"] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = (file: File, serverResponse: UploadResponse) => {
    setUploadedFile(file);
    setServerFile(serverResponse.file);
    setError(null);
    console.log("File uploaded successfully:", file.name, serverResponse);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    console.error("Upload error:", errorMessage);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 via-white to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-violet-950">
      {/* Header */}
      <header className="w-full px-8 py-6 border-b border-gray-200/50 dark:border-gray-800/50 backdrop-blur-sm">
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
      </header>

      {/* Main Content */}
      <div className="flex p-4 gap-4 h-[calc(100vh-88px)]">
        {/* Left Panel - Upload */}
        <div className="w-[30%] h-full">
          <div className="h-full bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-800/50">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Documents
              </h2>
            </div>

            {/* Upload Area */}
            <div className="flex-1 overflow-y-auto">
              <Upload
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-4 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat */}
        <div className="w-[70%] h-full">
          <div className="h-full bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-gray-200/50 dark:border-gray-800/50">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Chat
              </h2>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex items-center justify-center p-6">
              {uploadedFile ? (
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Ready to Chat!
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {uploadedFile.name} is loaded
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                    Start asking questions about your PDF
                  </p>
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
                    No Document Loaded
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Upload a PDF to start chatting
                  </p>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="px-6 py-4 border-t border-gray-200/50 dark:border-gray-800/50">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder={
                    uploadedFile
                      ? "Ask a question about your PDF..."
                      : "Upload a PDF first..."
                  }
                  disabled={!uploadedFile}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  disabled={!uploadedFile}
                  className="px-5 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
