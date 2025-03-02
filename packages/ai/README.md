# Document Embedding Service

This package handles the extraction, embedding, and storage of documents for the RAG (Retrieval-Augmented Generation) system.

## Overview

The document embedding service:

1. Listens for document uploads to the Appwrite "documents" bucket
2. Extracts text content from the uploaded documents (currently supporting PDF)
3. Chunks the text into manageable segments
4. Generates embeddings for each chunk using OpenAI's embedding model
5. Stores both document metadata and embeddings in a PostgreSQL database with pgvector extension

## Database Schema

The service uses two main tables:
- `documents` - Stores metadata about each document
- `document_chunks` - Stores text chunks with their vector embeddings

## Setup

### Environment Variables

Create a `.env` file with the following variables:

```env
POSTGRES_CONNECTION_STRING=postgresql://username:password@localhost:5432/yourdatabase
OPENAI_API_KEY=your-openai-api-key
APPWRITE_ENDPOINT=https://your-appwrite-instance.com/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
DOCUMENTS_BUCKET_ID=your-documents-bucket-id
```

### PgVector Setup

The database must have the pgvector extension installed. Migrations have been created to:
1. Install the pgvector extension
2. Create necessary tables and indexes
3. Create stored procedures for document operations

### Installing Dependencies

```bash
bun install
```

## Usage

### Appwrite Function

This package is designed to be deployed as an Appwrite function. The entry point is `appwriteFunction` which processes document upload events.

### Manual Document Processing

You can also use the `processPdfDocument` function directly:

```typescript
import { processPdfDocument } from '@biso/ai';

// Process a PDF document
const result = await processPdfDocument(
  pdfBuffer,
  {
    id: 'doc_123',
    title: 'My Document',
    source: 'manual-upload',
    fileName: 'document.pdf',
    fileType: 'pdf',
  },
  process.env.POSTGRES_CONNECTION_STRING
);
```

## Development

To run the service locally:

```bash
bun run dev
```

## Deployment

Deploy to Appwrite functions:

```bash
# Build the package
bun run build

# Deploy to Appwrite
appwrite deploy function
``` 