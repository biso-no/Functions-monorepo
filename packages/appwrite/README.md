# Appwrite Integration Package

This package provides utilities and helper functions for interacting with the Appwrite backend services used in BISO applications.

## 📦 Installation

```bash
bun install
# or
yarn install
```

## 🔧 Configuration

The package requires the following environment variables (In the root of the monorepo):

```env
APPWRITE_ENDPOINT=your_appwrite_endpoint
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
```

## 🚀 Usage

### Directly call Appwrite methods from a function
```typescript
import { createDocument, ID } from '@biso/appwrite';

// Example: Create a document
const document = await createDocument(
  'database_id',
  'collection_id',
  'document_id', // Or use the ID class provided. e.g ID.unique() to generate a unique ID.
  {
    property: 'some-data'
  }
);
```
### Create a function in the package.
In addition to calling Appwrite APIs directly from a function endpoint, you may create the functions in the package, exposing only that function to the endpoint.
In packages/appwrite:
```typescript
import { createDocument, ID } from '@biso/appwrite'

export async function someFunction({
  databaseId,
  collectionId,
  documentId,
  data
}: {
  databaseId: string
  collectionId: string
  documentId?: string
  data: any //Do not use the any type.
}) {
  const document = await createDocument(
    databaseId,
    collectionId,
    documentId ?? ID.unique(),
    data
)}
```
In functions/some-function:
```typescript
import { someFunction } from '@biso/appwrite'

const document = await someFunction({
  databaseId: 'database_id',
  collectionId: 'collection_id',
  data: {
    property: 'some_data'
  }
})
```

## 📚 Frequently used methods

### Database Operations
- `createDocument()`: Create a new document in a collection
- `getDocument()`: Retrieve a document by ID
- `updateDocument()`: Update an existing document
- `deleteDocument()`: Delete a document by ID

### Storage
- `uploadFile()`: Upload a file to Appwrite storage
- `getFile()`: Get file details and download URL
- `deleteFile()`: Delete a file from storage

## 🔐 Security

- Never commit API keys or sensitive credentials
- Always use environment variables for configuration
- Follow BISO's security guidelines for handling user data

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request with a clear description of changes

## 📞 Support

For support, please contact:

**Markus Heien**  
IT Manager, BI Student Organization  
Email: [markus@biso.no](mailto:markus@biso.no)  
Phone: +47 98471622

---

*Part of the BISO Functions Monorepo*
