# Appwrite Integration Package

This package provides utilities and helper functions for interacting with the Appwrite backend services used in BISO applications.

## 📦 Installation

```bash
bun install
# or
yarn install
```

## 🔧 Configuration

The package requires the following environment variables:

```env
APPWRITE_ENDPOINT=your_appwrite_endpoint
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
```

## 🚀 Usage

```typescript
import { initializeAppwrite, createDocument } from '@biso/appwrite';

// Initialize Appwrite client
const client = initializeAppwrite();

// Example: Create a document
const document = await createDocument({
  collectionId: 'your_collection_id',
  data: {
    // your document data
  }
});
```

## 📚 Available Functions

### Authentication
- `initializeAppwrite()`: Initialize the Appwrite client with configuration
- `getCurrentUser()`: Get the currently authenticated user

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
