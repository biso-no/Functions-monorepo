import { Client, Storage } from 'node-appwrite';
import { handleDocumentUpload } from './document-embedder.js';
import { initVectorStore } from './index.js';

// Initialize Appwrite client
function getAppwriteClient(): { client: Client, storage: Storage } {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || '')
    .setProject(process.env.APPWRITE_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || '');

  const storage = new Storage(client);
  
  return { client, storage };
}

// Update the fetchFileFromAppwrite function
export async function fetchFileFromAppwrite(bucketId: string, fileId: string): Promise<Buffer> {
  try {
    const { storage } = getAppwriteClient();
    const fileResponse = await storage.getFileDownload(bucketId, fileId);
    // fileResponse is already a Buffer, so return it directly
    return fileResponse;
  } catch (error) {
    console.error('Error fetching file from Appwrite:', error);
    throw error;
  }
}

// Main function to be triggered by Appwrite
export default async function appwriteFunction(req: any, res: any) {
  try {
    // Initialize vector store
    await initVectorStore();
    
    // Verify this is a storage event
    const { body } = req;
    const event = typeof body === 'string' ? JSON.parse(body) : body;
    
    // Check if this is a document upload event
    if (
      event?.event?.includes('storage.files.create') &&
      event?.payload?.bucketId === process.env.DOCUMENTS_BUCKET_ID
    ) {
      console.log('Processing document upload event:', event.payload.name);
      
      // Handle the document upload
      const result = await handleDocumentUpload(event);
      
      return res.json({
        success: true,
        message: 'Document processed successfully',
        result
      });
    }
    
    // Not a document upload event we want to handle
    return res.json({
      success: false,
      message: 'Not a document upload event for the documents bucket'
    });
  } catch (error) {
    console.error('Error in Appwrite function:', error);
    
    return res.json({
      success: false,
      message: 'Error processing document',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
} 