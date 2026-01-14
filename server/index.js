import 'dotenv/config';
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Qdrant configuration
const QDRANT_URL = "https://1f4bc840-0038-4f00-8eba-a5e411b756c3.europe-west3-0.gcp.cloud.qdrant.io";
const QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.biLBK0EfUqCdJq3pQvO3Ppun46HmJVFhLYq_kPcNY4E";
const COLLECTION_NAME = "pdf-embeddings";

const queue = new Queue("file-upload-queue", { connection: { host: 'localhost', port: 6379 } });

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

// Initialize embeddings
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "text-embedding-004",
});

// Initialize Gemini Chat Model
const chatModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-3-flash-preview",
  temperature: 0.7,
});

// File filter for PDF only
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "PDF Chat Server is running" });
});

// Upload PDF endpoint
app.post("/upload/pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File uploaded:", req.file.originalname);
    
    const jobData = {
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
      size: req.file.size,
    };
    
    console.log("Adding job to queue:", jobData);
    const job = await queue.add("file-ready", JSON.stringify(jobData));
    console.log("Job added with ID:", job.id);

    res.json({
      success: true,
      message: "File uploaded successfully",
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
      },
      jobId: job.id,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// Chat endpoint - query the vector store
app.post('/chat', async (req, res) => {
  try {
    const { query } = req.body;

    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log("Received query:", query);

    // Connect to existing Qdrant vector store
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
        collectionName: COLLECTION_NAME,
      }
    );

    // Create retriever and search
    const retriever = vectorStore.asRetriever({
      k: 2,
    });
    
    const results = await retriever.invoke(query);
    console.log(`Found ${results.length} relevant chunks`);

    // Build context from retrieved documents
    const context = results.map(doc => doc.pageContent).join("\n\n");

    // Create prompt for Gemini
    const prompt = `You are a helpful AI assistant that answers questions based on the provided PDF context.

Context from PDF:
${context}

User Question: ${query}

Please provide a helpful, accurate answer based only on the context provided above. If the context doesn't contain enough information to answer the question, say so.`;

    // Get response from Gemini
    console.log("Generating AI response...");
    const aiResponse = await chatModel.invoke(prompt);
    
    return res.json({ 
      success: true,
      query,
      answer: aiResponse.content,
      sources: results.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata,
      }))
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
});

// Error handling middleware for multer errors
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size must be less than 10MB" });
    }
    return res.status(400).json({ error: error.message });
  }
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
