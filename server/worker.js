import 'dotenv/config';
import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import prisma from "./lib/prisma.js";

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

// Batch size for uploading vectors (smaller batches prevent timeouts)
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


async function addDocumentsInBatches(vectorStore, documents, embeddings, job) {
  const totalBatches = Math.ceil(documents.length / BATCH_SIZE);
  console.log(`📦 Processing ${documents.length} chunks in ${totalBatches} batches...`);

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const batch = documents.slice(i, i + BATCH_SIZE);
    
    let retries = 0;
    let success = false;

    while (!success && retries < MAX_RETRIES) {
      try {
        await job.updateProgress(Math.round((batchNumber / totalBatches) * 100));
        
        console.log(`  📤 Uploading batch ${batchNumber}/${totalBatches} (${batch.length} chunks)...`);
        await vectorStore.addDocuments(batch);
        
        success = true;
        console.log(`  ✅ Batch ${batchNumber}/${totalBatches} uploaded successfully`);
        
        // Small delay between batches to prevent rate limiting
        if (i + BATCH_SIZE < documents.length) {
          await delay(100);
        }
      } catch (error) {
        retries++;
        console.error(`  ⚠️ Batch ${batchNumber} failed (attempt ${retries}/${MAX_RETRIES}):`, error.message);
        
        if (retries < MAX_RETRIES) {
          const waitTime = Math.pow(2, retries) * 1000;
          console.log(`  ⏳ Waiting ${waitTime}ms before retry...`);
          await delay(waitTime);
        } else {
          throw new Error(`Failed to upload batch ${batchNumber} after ${MAX_RETRIES} attempts: ${error.message}`);
        }
      }
    }
  }
  
  console.log(`✅ All ${totalBatches} batches uploaded successfully!`);
}

const worker = new Worker('file-upload-queue', async (job) => {
  try {
    console.log("=== Processing Job ===");
    console.log("Job ID:", job.id);
    
    const data = JSON.parse(job.data);
    console.log("File path:", data.path);
    console.log("PDF ID:", data.pdfId);
    console.log("Collection ID:", data.collectionId);

    // Step 1: Load the PDF
    console.log("📄 Loading PDF...");
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();
    console.log(`✅ Loaded ${docs.length} pages from PDF`);

    // Step 2: Split documents into chunks
    console.log("✂️ Splitting documents into chunks...");
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`✅ Created ${splitDocs.length} chunks`);

    // Add metadata to each chunk
    const docsWithMetadata = splitDocs.map((doc, index) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        pdfId: data.pdfId,
        filename: data.filename,
        chunkIndex: index,
        uploadedAt: new Date().toISOString(),
      },
    }));

    // Step 3: Create embeddings using Gemini
    console.log("🧠 Initializing embeddings model...");
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "text-embedding-004",
    });

    // Step 4: Initialize Qdrant client and create collection
    console.log("🗄️ Setting up Qdrant collection...");
    const qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });

    // Check if collection exists, if not create it
    try {
      await qdrantClient.getCollection(data.collectionId);
      console.log(`  Collection ${data.collectionId} already exists`);
    } catch (error) {
      // Collection doesn't exist, create it
      console.log(`  Creating collection ${data.collectionId}...`);
      await qdrantClient.createCollection(data.collectionId, {
        vectors: {
          size: 768, // text-embedding-004 vector size
          distance: "Cosine",
        },
      });
      console.log(`  ✅ Collection created`);
    }

    // Create vector store instance for this collection
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
        collectionName: data.collectionId,
      }
    );

    // Step 5: Upload documents in batches
    await addDocumentsInBatches(vectorStore, docsWithMetadata, embeddings, job);

    // Step 6: Update the PDF record in database
    await prisma.pdf.update({
      where: { id: data.pdfId },
      data: {
        status: "ready",
        pageCount: docs.length,
        chunkCount: docsWithMetadata.length,
      },
    });

    console.log(`🎉 PDF ${data.pdfId} processed successfully!`);
    
    return { 
      success: true, 
      pdfId: data.pdfId,
      filename: data.filename,
      pagesCount: docs.length,
      chunksCount: docsWithMetadata.length,
      collectionId: data.collectionId,
    };
  } catch (error) {
    console.error("❌ Error processing job:", error);
    
    // Update PDF status to failed
    try {
      const data = JSON.parse(job.data);
      if (data.pdfId) {
        await prisma.pdf.update({
          where: { id: data.pdfId },
          data: { status: "failed" },
        });
      }
    } catch (updateError) {
      console.error("❌ Failed to update PDF status:", updateError.message);
    }
    
    throw error;
  }
}, { 
  concurrency: 1, // Reduced concurrency to prevent overload
  connection: { 
    host: process.env.REDIS_HOST, 
    password: process.env.REDIS_PASSWORD, 
    port: parseInt(process.env.REDIS_PORT), 
    username: process.env.REDIS_USERNAME,
    tls: {}
  },
  lockDuration: 300000, // 5 minutes lock (prevents "stalled" errors for large PDFs)
  lockRenewTime: 150000, // Renew lock every 2.5 minutes
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