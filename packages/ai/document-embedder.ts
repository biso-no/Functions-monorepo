import { MDocument } from "@mastra/rag";
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import pdfParse from "pdf-parse";
import { fetchFileFromAppwrite } from "./appwrite-function.js";
import { getVectorStore } from "./index.js";

// Types for document metadata
type DocumentMetadata = {
  id: string;
  title: string;
  description?: string;
  source: string;
  fileName: string;
  fileType: string;
  fileUrl?: string;
  author?: string;
  department?: string;
  tags?: string[];
  confidentiality?: string;
  language?: string;
};

/**
 * Process a PDF document, extract its content, generate embeddings, and store in PostgreSQL
 * 
 * @param pdfBuffer - The PDF file buffer
 * @param metadata - Document metadata
 * @returns Processing statistics
 */
export async function processPdfDocument(
  pdfBuffer: Buffer,
  metadata: DocumentMetadata
) {
  console.log(`Processing document: ${metadata.title}`);
  const startTime = Date.now();

  try {
    // 1. Parse the PDF
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    const numPages = pdfData.numpages || 1;
    const wordCount = text.split(/\s+/).length;

    console.log(`Extracted ${numPages} pages with ${wordCount} words`);

    // 2. Create a document and chunk it
    const doc = MDocument.fromText(text, {
      // Add metadata for context
      metadata: {
        title: metadata.title,
        source: metadata.source,
        fileName: metadata.fileName,
        fileType: metadata.fileType,
        author: metadata.author,
      }
    });

    const chunks = await doc.chunk({
      strategy: "recursive",
      size: 1000,       // Adjust chunk size as needed
      overlap: 200,     // Some overlap between chunks
      separator: "\n",  // Split at newlines when possible
    });

    console.log(`Created ${chunks.length} chunks from document`);

    // 3. Generate embeddings with OpenAI using ai-sdk
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: chunks.map(chunk => chunk.text),
    });

    console.log(`Generated ${embeddings.length} embeddings`);

    // 4. Get the vector store from the shared instance
    const pgVector = getVectorStore();

    // 5. Prepare metadata for each chunk
    const chunksMetadata = chunks.map((chunk, index) => {
      return {
        id: `${metadata.id}_chunk_${index}`,
        documentId: metadata.id,
        chunkIndex: index,
        title: metadata.title,
        source: metadata.source,
        fileName: metadata.fileName,
        fileType: metadata.fileType,
        text: chunk.text,
        pageNumber: chunk.metadata?.pageNumber || 1,
        section: chunk.metadata?.section || '',
        author: metadata.author || '',
        department: metadata.department || '',
        tags: metadata.tags || [],
        confidentiality: metadata.confidentiality || 'internal',
        language: metadata.language || 'en',
        vectorModel: 'text-embedding-3-small',
        createdAt: new Date().toISOString(),
        uploadedAt: new Date().toISOString(),
        metadata: chunk.metadata || {}
      };
    });

    // 6. Store the document chunks with their embeddings
    await pgVector.upsert({
      indexName: "documents",
      vectors: embeddings,
      metadata: chunksMetadata,
    });

    console.log(`Stored ${chunksMetadata.length} document chunks with embeddings`);
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      documentId: metadata.id,
      numPages,
      numChunks: chunks.length,
      wordCount,
      processingTime
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

/**
 * Handle document upload event from Appwrite
 * This function will be triggered when a document is uploaded to the "documents" bucket
 */
export async function handleDocumentUpload(event: any) {
  // Extract information from the Appwrite event
  const { bucketId, fileId, name, sizeOriginal, mimeType, path } = event.payload;
  
  // Only process PDF files
  if (mimeType !== 'application/pdf') {
    console.log(`Skipping non-PDF file: ${name} (${mimeType})`);
    return { success: false, error: 'Only PDF files are supported' };
  }

  try {
    // 1. Fetch the file from Appwrite
    const fileBuffer = await fetchFileFromAppwrite(bucketId, fileId);
    
    // 2. Create metadata for the document
    const documentId = `doc_${fileId}`;
    const metadata: DocumentMetadata = {
      id: documentId,
      title: name.replace(/\.pdf$/i, ''),  // Use filename as title, without extension
      source: 'appwrite',
      fileName: name,
      fileType: 'pdf',
      fileUrl: path, // Or construct a proper URL to the file
    };
    
    // 3. Process the document
    const result = await processPdfDocument(
      fileBuffer, 
      metadata
    );
    
    return result;
  } catch (error) {
    console.error('Error processing document upload:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 