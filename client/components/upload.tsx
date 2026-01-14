"use client";

import React, { useState, useRef, useCallback } from "react";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_MAIN_API_URL;

interface UploadedFile {
  file: File;
  id: string;
  name: string;
  size: string;
  status: "uploading" | "success" | "error";
  progress: number;
  serverFilename?: string;
}

interface UploadProps {
  onUploadComplete?: (file: File, serverResponse: UploadResponse) => void;
  onUploadError?: (error: string) => void;
}

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

export default function Upload({
  onUploadComplete,
  onUploadError,
}: UploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const generateId = (): string => {
    return Math.random().toString(36).substring(2, 15);
  };

  const handleUpload = async (file: File): Promise<void> => {
    // Validate file type
    if (file.type !== "application/pdf") {
      onUploadError?.("Please upload a PDF file only");
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      onUploadError?.("File size must be less than 10MB");
      return;
    }

    const fileId = generateId();
    const newFile: UploadedFile = {
      file,
      id: fileId,
      name: file.name,
      size: formatFileSize(file.size),
      status: "uploading",
      progress: 0,
    };

    setUploadedFiles((prev) => [...prev, newFile]);
    setIsUploading(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);

      // Upload file to backend with progress tracking
      const response = await axios.post<UploadResponse>(
        `${API_BASE_URL}/upload/pdf`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadedFiles((prev) =>
              prev.map((f) => (f.id === fileId ? { ...f, progress } : f))
            );
          },
        }
      );

      // Update status to success
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: "success",
                progress: 100,
                serverFilename: response.data.file.filename,
              }
            : f
        )
      );

      onUploadComplete?.(file, response.data);
    } catch (error) {
      console.error("Upload error:", error);

      let errorMessage = "Failed to upload file";
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error" } : f))
      );
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleUpload(files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleUpload(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="w-full p-4 flex flex-col gap-4">
      {/* Upload Zone */}
      <div
        onClick={handleClick}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer
          border-2 border-dashed rounded-2xl
          p-8 transition-all duration-300 ease-out
          flex flex-col items-center justify-center gap-4
          min-h-[200px]
          ${
            isDragActive
              ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]"
              : "border-gray-300 dark:border-gray-700 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
          }
        `}
      >
        {/* Animated Background Gradient */}
        <div
          className={`
            absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300
            bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-indigo-500/10
            ${isDragActive ? "opacity-100" : ""}
          `}
        />

        {/* Upload Icon */}
        <div
          className={`
            relative z-10
            w-16 h-16 rounded-full
            bg-gradient-to-br from-violet-500 to-purple-600
            flex items-center justify-center
            shadow-lg shadow-violet-500/25
            transition-transform duration-300
            ${isDragActive ? "scale-110 rotate-12" : ""}
          `}
        >
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        {/* Text Content */}
        <div className="relative z-10 text-center">
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {isDragActive ? "Drop your PDF here" : "Upload your PDF"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Drag and drop or{" "}
            <span className="text-violet-600 dark:text-violet-400 font-medium">
              browse
            </span>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            PDF files only • Max 10MB
          </p>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Uploaded Files
          </h3>
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className={`
                relative overflow-hidden
                bg-white dark:bg-gray-800/50
                border border-gray-200 dark:border-gray-700
                rounded-xl p-4
                transition-all duration-300
                ${
                  file.status === "success"
                    ? "border-l-4 border-l-green-500"
                    : ""
                }
                ${file.status === "error" ? "border-l-4 border-l-red-500" : ""}
              `}
            >
              {/* Progress Bar Background */}
              {file.status === "uploading" && (
                <div
                  className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-purple-500/10 transition-all duration-300"
                  style={{ width: `${file.progress}%` }}
                />
              )}

              <div className="relative z-10 flex items-center gap-3">
                {/* PDF Icon */}
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400"
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

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {file.size}
                    {file.status === "uploading" && ` • ${file.progress}%`}
                    {file.status === "success" && " • Uploaded"}
                    {file.status === "error" && " • Failed"}
                  </p>
                </div>

                {/* Status / Actions */}
                <div className="flex items-center gap-2">
                  {file.status === "uploading" && (
                    <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {file.status === "success" && (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
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
                  )}
                  {file.status === "error" && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
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
                  )}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
