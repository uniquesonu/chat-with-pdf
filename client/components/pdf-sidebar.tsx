"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useUser } from "@clerk/nextjs";

const API_BASE_URL = process.env.NEXT_PUBLIC_MAIN_API_URL;

interface Pdf {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  pageCount: number | null;
  chunkCount: number | null;
  status: "processing" | "ready" | "failed";
  jobId: string | null;
  collectionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PdfSidebarProps {
  selectedPdfId: string | null;
  onSelectPdf: (pdf: Pdf) => void;
  onUploadNew: () => void;
  refreshTrigger?: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function PdfSidebar({
  selectedPdfId,
  onSelectPdf,
  onUploadNew,
  refreshTrigger,
}: PdfSidebarProps) {
  const { user, isLoaded } = useUser();
  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<Record<string, number>>({});
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPdfs = useCallback(
    async (showLoading = false) => {
      if (!user?.id) return;

      try {
        if (showLoading) setIsLoading(true);
        setError(null);
        const response = await axios.get(`${API_BASE_URL}/pdfs/${user.id}`);
        setPdfs(response.data.pdfs);
      } catch (err) {
        console.error("Error fetching PDFs:", err);
        setError("Failed to load PDFs");
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [user?.id]
  );

  // Initial fetch and refresh trigger
  useEffect(() => {
    if (isLoaded && user?.id) {
      fetchPdfs(true);
    }
  }, [isLoaded, user?.id, refreshTrigger, fetchPdfs]);

  // Poll for processing status updates - separate effect with stable check
  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const hasProcessingPdfs = pdfs.some((p) => p.status === "processing");

    if (hasProcessingPdfs && user?.id) {
      pollingIntervalRef.current = setInterval(() => {
        fetchPdfs(false); // Don't show loading state during polling
      }, 5000); // Poll every 5 seconds instead of 3
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [
    pdfs.length,
    pdfs.map((p) => `${p.id}:${p.status}`).join(","),
    user?.id,
    fetchPdfs,
  ]);

  // Poll for progress updates on processing PDFs
  useEffect(() => {
    // Clear any existing progress interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    const processingPdfs = pdfs.filter(
      (p) => p.status === "processing" && p.jobId
    );

    if (processingPdfs.length > 0) {
      const fetchProgress = async () => {
        const progressUpdates: Record<string, number> = {};

        await Promise.all(
          processingPdfs.map(async (pdf) => {
            try {
              const response = await axios.get(
                `${API_BASE_URL}/job/${pdf.jobId}/progress`
              );
              if (response.data.success) {
                progressUpdates[pdf.id] = response.data.progress;
              }
            } catch (err) {
              // Ignore errors for individual progress fetches
              console.error(`Failed to fetch progress for ${pdf.id}:`, err);
            }
          })
        );

        if (Object.keys(progressUpdates).length > 0) {
          setPdfProgress((prev) => ({ ...prev, ...progressUpdates }));
        }
      };

      // Fetch immediately
      fetchProgress();

      // Then poll every 2 seconds for smoother updates
      progressIntervalRef.current = setInterval(fetchProgress, 2000);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [pdfs.map((p) => `${p.id}:${p.status}:${p.jobId}`).join(",")]);

  const handleDeletePdf = async (pdfId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this PDF?")) return;

    try {
      await axios.delete(`${API_BASE_URL}/pdf/${pdfId}`);
      setPdfs((prev) => prev.filter((p) => p.id !== pdfId));
      if (selectedPdfId === pdfId) {
        onSelectPdf(null as unknown as Pdf);
      }
    } catch (err) {
      console.error("Error deleting PDF:", err);
      alert("Failed to delete PDF");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return (
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        );
      case "ready":
        return (
          <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg
              className="w-2.5 h-2.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case "failed":
        return (
          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <svg
              className="w-2.5 h-2.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Your Documents
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {pdfs.length} {pdfs.length === 1 ? "file" : "files"}
          </span>
        </div>
      </div>

      {/* Upload Button */}
      <div className="p-3">
        <button
          onClick={onUploadNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Upload New PDF
        </button>
      </div>

      {/* PDF List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => fetchPdfs(true)}
              className="mt-2 text-xs text-violet-600 hover:text-violet-700"
            >
              Try again
            </button>
          </div>
        ) : pdfs.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No PDFs uploaded yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Upload your first document to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pdfs.map((pdf) => (
              <button
                key={pdf.id}
                onClick={() => pdf.status === "ready" && onSelectPdf(pdf)}
                disabled={pdf.status !== "ready"}
                className={`w-full text-left p-3 rounded-xl border transition-all group ${
                  selectedPdfId === pdf.id
                    ? "bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700 shadow-sm"
                    : pdf.status === "ready"
                    ? "bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-violet-300 dark:hover:border-violet-700"
                    : "bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 opacity-70 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* PDF Icon */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedPdfId === pdf.id
                        ? "bg-violet-100 dark:bg-violet-900/40"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 ${
                        selectedPdfId === pdf.id
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>

                  {/* PDF Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {pdf.originalName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(pdf.fileSize)}
                      </span>
                      {pdf.pageCount && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">
                            •
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {pdf.pageCount} pages
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatDate(pdf.createdAt)}
                    </p>
                  </div>

                  {/* Status/Actions */}
                  <div className="flex items-center gap-2">
                    {getStatusIcon(pdf.status)}
                    {pdf.status === "ready" && (
                      <button
                        onClick={(e) => handleDeletePdf(pdf.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Text with Progress Bar */}
                {pdf.status === "processing" && (
                  <div className="mt-3 space-y-2">
                    {/* Progress Bar Container */}
                    <div className="relative">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        {/* Animated Progress Bar */}
                        <div
                          className="h-full rounded-full relative transition-all duration-500 ease-out"
                          style={{
                            width: `${pdfProgress[pdf.id] || 0}%`,
                            background:
                              "linear-gradient(90deg, #8B5CF6 0%, #A78BFA 50%, #C4B5FD 100%)",
                          }}
                        >
                          {/* Shimmer Effect */}
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                            style={{
                              backgroundSize: "200% 100%",
                            }}
                          />
                        </div>
                      </div>
                      {/* Glow Effect */}
                      {(pdfProgress[pdf.id] || 0) > 0 && (
                        <div
                          className="absolute top-0 h-2 rounded-full blur-sm opacity-50 transition-all duration-500"
                          style={{
                            width: `${pdfProgress[pdf.id] || 0}%`,
                            background:
                              "linear-gradient(90deg, #8B5CF6 0%, #A78BFA 100%)",
                          }}
                        />
                      )}
                    </div>

                    {/* Progress Text */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {(pdfProgress[pdf.id] || 0) < 20
                            ? "📄 Loading PDF..."
                            : (pdfProgress[pdf.id] || 0) < 50
                            ? "✂️ Analyzing content..."
                            : (pdfProgress[pdf.id] || 0) < 90
                            ? "🧠 Creating embeddings..."
                            : "✨ Completing..."}
                        </span>
                      </div>
                      <span className="text-violet-600 dark:text-violet-400 font-bold tabular-nums">
                        {pdfProgress[pdf.id] || 0}%
                      </span>
                    </div>
                  </div>
                )}
                {pdf.status === "failed" && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <span>Processing failed</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="px-4 py-3 border-t border-gray-200/50 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/30">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          💡 Tips
        </p>
        <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
          <li>• Click on a PDF to start chatting</li>
          <li>• Upload PDF files up to 10MB</li>
          <li>• All your PDFs are saved automatically</li>
        </ul>
      </div>
    </div>
  );
}

export type { Pdf };
