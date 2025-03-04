

// Import Mastra components
import { PgVector } from "@mastra/pg";

// Initialize vector storage
let vectorStore: PgVector | undefined;

/**
 * Initialize the PgVector store
 */
export async function initVectorStore() {
  if (!process.env.POSTGRES_CONNECTION_STRING) {
    throw new Error("POSTGRES_CONNECTION_STRING environment variable is required");
  }

  try {
    // Just initialize the connection, index creation is handled by the Mastra server
    vectorStore = new PgVector(process.env.POSTGRES_CONNECTION_STRING);
    console.log("Vector store initialized");
    return vectorStore;
  } catch (error) {
    console.error("Failed to initialize vector store:", error);
    throw error;
  }
}


/**
 * Get the vector store instance
 */
export function getVectorStore() {
  if (!vectorStore) {
    throw new Error("Vector store not initialized. Call initVectorStore() first.");
  }
  return vectorStore;
}

// Export document embedding functionality
export { processPdfDocument, handleDocumentUpload } from './document-embedder.js';

// Export Appwrite function for deployment
export { default as appwriteFunction } from './appwrite-function.js';
