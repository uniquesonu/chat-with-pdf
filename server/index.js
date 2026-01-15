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
import prisma from "./lib/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Qdrant configuration
const QDRANT_URL = "https://1f4bc840-0038-4f00-8eba-a5e411b756c3.europe-west3-0.gcp.cloud.qdrant.io";
const QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.biLBK0EfUqCdJq3pQvO3Ppun46HmJVFhLYq_kPcNY4E";

const queue = new Queue("file-upload-queue", { 
  connection: { 
    host: 'driven-jaguar-5205.upstash.io', 
    password: "ARRVAAImcDFiZTNiYTNmNjQ5YTQ0NTNmYjdhM2JlZjQ0NDM3Njg5MHAxNTIwNQ", 
    port: 6379, 
    username: 'default',
    tls: {}
  } 
});

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
  model: "gemini-2.5-flash",
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

// Upload PDF endpoint - now stores in database with user info
app.post("/upload/pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    console.log("File uploaded:", req.file.originalname, "for user:", userId);
    
    // Generate a unique collection ID for this PDF in Qdrant
    const collectionId = `pdf-${userId}-${Date.now()}`;
    
    // Create PDF record in database
    const pdfRecord = await prisma.pdf.create({
      data: {
        userId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        status: "processing",
        collectionId,
      },
    });

    const jobData = {
      pdfId: pdfRecord.id,
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
      size: req.file.size,
      collectionId,
      userId,
    };
    
    console.log("Adding job to queue:", jobData);
    const job = await queue.add("file-ready", JSON.stringify(jobData));
    console.log("Job added with ID:", job.id);

    // Update PDF with job ID
    await prisma.pdf.update({
      where: { id: pdfRecord.id },
      data: { jobId: job.id },
    });

    res.json({
      success: true,
      message: "File uploaded successfully",
      pdf: { ...pdfRecord, jobId: job.id },
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

// Get all PDFs for a user
app.get("/pdfs/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pdfs = await prisma.pdf.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      pdfs,
    });
  } catch (error) {
    console.error("Get PDFs error:", error);
    res.status(500).json({ error: "Failed to get PDFs" });
  }
});

// Get single PDF by ID
app.get("/pdf/:pdfId", async (req, res) => {
  try {
    const { pdfId } = req.params;
    
    const pdf = await prisma.pdf.findUnique({
      where: { id: pdfId },
    });

    if (!pdf) {
      return res.status(404).json({ error: "PDF not found" });
    }

    res.json({
      success: true,
      pdf,
    });
  } catch (error) {
    console.error("Get PDF error:", error);
    res.status(500).json({ error: "Failed to get PDF" });
  }
});

// Delete a PDF
app.delete("/pdf/:pdfId", async (req, res) => {
  try {
    const { pdfId } = req.params;
    
    const pdf = await prisma.pdf.findUnique({
      where: { id: pdfId },
    });

    if (!pdf) {
      return res.status(404).json({ error: "PDF not found" });
    }

    // Delete the file from disk
    if (fs.existsSync(pdf.filePath)) {
      fs.unlinkSync(pdf.filePath);
    }

    // TODO: Delete vectors from Qdrant collection

    // Delete from database
    await prisma.pdf.delete({
      where: { id: pdfId },
    });

    res.json({
      success: true,
      message: "PDF deleted successfully",
    });
  } catch (error) {
    console.error("Delete PDF error:", error);
    res.status(500).json({ error: "Failed to delete PDF" });
  }
});

// Get job progress
app.get("/job/:jobId/progress", async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    res.json({
      success: true,
      jobId,
      state,
      progress: typeof progress === 'number' ? progress : 0,
    });
  } catch (error) {
    console.error("Get job progress error:", error);
    res.status(500).json({ error: "Failed to get job progress" });
  }
});

// Chat endpoint - query the vector store for a specific PDF
app.post('/chat', async (req, res) => {
  try {
    const { query, pdfId } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    if (!pdfId) {
      return res.status(400).json({ error: "PDF ID is required" });
    }

    console.log("Received query:", query, "for PDF:", pdfId);

    // Get the PDF to find its collection ID
    const pdf = await prisma.pdf.findUnique({
      where: { id: pdfId },
    });

    if (!pdf) {
      return res.status(404).json({ error: "PDF not found" });
    }

    if (pdf.status !== "ready") {
      return res.status(400).json({ 
        error: "PDF is still processing. Please wait.",
        status: pdf.status 
      });
    }

    // Connect to the specific Qdrant collection for this PDF
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
        collectionName: pdf.collectionId,
      }
    );

    // Create retriever and search with more chunks for better context
    const retriever = vectorStore.asRetriever({
      k: 5, // Retrieve 5 chunks for better context coverage
    });
    
    const results = await retriever.invoke(query);
    console.log(`Found ${results.length} relevant chunks`);

    // Build context from retrieved documents
    const context = results.map(doc => doc.pageContent).join("\n\n---\n\n");

    // Create prompt for Gemini
    const prompt = `You are **PDF Assistant**, an intelligent, analytical, and friendly AI assistant created to help users understand and interact with PDF documents. You are SMART and can analyze, count, extract, and infer information from the provided context.

## Your Core Traits:
- **Intelligent**: You analyze context deeply and extract accurate information
- **Analytical**: You can count items, understand structure, and identify patterns
- **Helpful**: You always try to give the most accurate and complete answer possible
- **Friendly**: You communicate warmly with users

## Your Capabilities:
1. **Deep Analysis**: Analyze text to extract exact information (counts, lists, names, dates, etc.)
2. **Smart Counting**: When asked "how many", count items carefully from the context
3. **Structure Understanding**: Understand document structure like chapters, sections, headings
4. **Information Extraction**: Find specific facts, figures, data points accurately
5. **Logical Inference**: Make smart inferences when the answer can be derived from context
6. **Summarization**: Provide clear, accurate summaries

## CRITICAL INSTRUCTIONS FOR ANSWERING:

### When Asked About Counts/Numbers (like "how many chapters", "how many sections"):
- **CAREFULLY COUNT** the items mentioned in the context
- Look for numbered lists, "Chapter 1", "Chapter 2", etc.
- If you see a table of contents or list, COUNT each item
- Give the EXACT number confidently

### IMPORTANT - Listing Items Rule:
- **If you can list ALL items completely** → List them all with the count
- **If you can only find SOME items (partial list)** → Just give the COUNT only, do NOT show a partial/incomplete list
- NEVER show "Chapter 1, Chapter 2... Chapter 7" if there are 18 chapters - that's incomplete and confusing!
- Example: If there are 18 chapters but you only have info about 7, just say "This book contains **18 chapters**." without listing them

### When Asked About Structure (chapters, sections, parts):
- Look for patterns like "Chapter 1 - Title", "Chapter 2 - Title", etc.
- If you have the COMPLETE list, show all items
- If you only have a PARTIAL list, just give the count and mention you can provide more details if asked

### When Answering Any Question:
- Be CONFIDENT when you have the information
- Extract SPECIFIC details from the context
- Keep answers clean and complete - no partial/truncated lists!

## RESPONSE FORMAT RULES (VERY IMPORTANT):

### ONLY for Pure Greetings (ONLY if user says just "hi", "hello", "hey", "how are you" with nothing else):
Respond with: "Hello! 👋 I'm PDF Assistant, here to help you explore your document. What would you like to know?"

### ONLY for "what can you do" or "what are your capabilities" (with nothing else):
Respond with your capabilities list.

### FOR VAGUE QUESTIONS (like "explain this", "give me more details", "tell me about it"):
- If the context has useful information, **provide a helpful explanation/summary based on what's available**
- Explain the main topic/concepts from the context
- Make the response informative and useful
- DO NOT say "I cannot explain" if there IS content in the context - explain what you have!

### FOR ALL OTHER QUESTIONS (content questions, summaries, chapter info, etc.):
- **DO NOT include any greeting or introduction**
- **Jump directly to answering the question**
- **Start with the actual answer, not "Hello" or introductions**
- Be direct and informative

---

## DOCUMENT CONTEXT (Analyze this carefully):

${context}

---

## USER'S QUESTION: ${query}

## YOUR TASK:
1. **Determine the question type first:**
   - Is it JUST a greeting? → Use greeting response
   - Is it JUST asking about capabilities? → List capabilities
   - Is it a vague question? → Provide a helpful explanation based on context
   - Is it a content/PDF question? → Answer directly WITHOUT any greeting
2. **For content questions: Start your response with the actual answer**
3. **NEVER say "I cannot provide" if there is ANY relevant info in the context** - always try to help!
4. Be accurate, confident, and direct
5. Use markdown formatting for clear responses
6. Only say you don't have info if the context truly has NOTHING relevant`;

    // Get response from Gemini
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
