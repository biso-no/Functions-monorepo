// Check that required environment variables are set
const requiredEnvVars = [
  'POSTGRES_CONNECTION_STRING',
  'OPENAI_API_KEY',
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'DOCUMENTS_BUCKET_ID',
];

// In production, we should fail if any of these are missing
if (process.env.NODE_ENV === 'production') {
  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    // Uncomment below to fail on missing vars in production
    // process.exit(1);
  }
} else {
  // In development, just log warnings
  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missingVars.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
  }
}

export default {}; 