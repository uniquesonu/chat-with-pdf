import 'dotenv/config';
import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Qdrant configuration
const QDRANT_URL = "https://1f4bc840-0038-4f00-8eba-a5e411b756c3.europe-west3-0.gcp.cloud.qdrant.io";
const QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.biLBK0EfUqCdJq3pQvO3Ppun46HmJVFhLYq_kPcNY4E";
const COLLECTION_NAME = "pdf-embeddings";

const worker = new Worker('file-upload-queue', async (job) => {
  try {
    console.log("=== Processing Job ===");
    console.log("Job ID:", job.id);
    
    const data = JSON.parse(job.data);
    console.log("File path:", data.path);

    // Step 1: Load the PDF
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} pages from PDF`);

    // Step 2: Split documents into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);

    // Add metadata to each chunk
    const docsWithMetadata = splitDocs.map((doc, index) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        filename: data.filename,
        chunkIndex: index,
        uploadedAt: new Date().toISOString(),
      },
    }));

    // Step 3: Create embeddings using Gemini
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "text-embedding-004",
    });

    // Step 4: Store in Qdrant vector database
    const vectorStore = await QdrantVectorStore.fromDocuments(
      docsWithMetadata,
      embeddings,
      {
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
        collectionName: COLLECTION_NAME,
      }
    );

    
    return { 
      success: true, 
      filename: data.filename,
      pagesCount: docs.length,
      chunksCount: docsWithMetadata.length,
    };
  } catch (error) {
    console.error("❌ Error processing job:", error);
    throw error;
  }
}, { 
  concurrency: 5, 
  connection: { host: 'localhost', port: 6379 } 
});

worker.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed!`);
  console.log("Result:", result);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

worker.on('ready', () => {
  console.log('🚀 Worker is ready and listening for jobs...');
});