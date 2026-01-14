import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { CharacterTextSplitter } from "@langchain/textsplitters";

const worker = new Worker('file-upload-queue', async job => {
  try {
    console.log("Processing job:", job.id);
    console.log("Job data:", job.data);
    const data = JSON.parse(job.data);
    /* 
    path: data.path,
    read the pdf file from path,
    chunk the pdf,
    call to gemini embedding model for every chunk,
    save the embedding in the quadrant db,
    */

    // load the pdf
    console.log("Loading PDF from:", data.path);
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();
    console.log("Loaded docs count:", docs.length);

    const client = new QdrantVectorStore({
      url: "https://1f4bc840-0038-4f00-8eba-a5e411b756c3.europe-west3-0.gcp.cloud.qdrant.io",
      apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.biLBK0EfUqCdJq3pQvO3Ppun46HmJVFhLYq_kPcNY4E",
    })

    const embeddings = new OpenAIEmbeddings({
      
    })
    
    const textSplitter = new CharacterTextSplitter({ chunkSize: 300, chunkOverlap: 0 });
    const texts = await textSplitter.splitDocuments(docs);
    console.log("Split texts count:", texts.length);
    console.log("texts", texts);
    
    return { success: true, textsCount: texts.length };
  } catch (error) {
    console.error("Error processing job:", error);
    throw error;
  }
}, { concurrency: 100, connection: { host: 'localhost', port: 6379 } });

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err.message);
});

worker.on('ready', () => {
  console.log('Worker is ready and listening for jobs...');
});