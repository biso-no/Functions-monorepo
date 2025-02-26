import { createAdminClient } from "@biso/appwrite";
import { createGraphClient } from "@biso/m365";

type Context = {
  req: any;
  res: any;
  log: (msg: any) => void;
  error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
  try {
    // Get campus and departmentId from request body
    const { campus, departmentId } = req.body;
    
    // Validate request parameters
    if (!campus || !departmentId) {
      return res.json({
        success: false,
        message: 'Missing required parameters: campus and departmentId are required'
      }, 400);
    }

    log(`Processing request for department ${departmentId} in campus ${campus}`);
    
    // Initialize Appwrite admin client
    const { databases } = await createAdminClient();
    
    // Find the department in the database
    let department;
    try {
      department = await databases.getDocument('app', 'departments', departmentId);
      log(`Found department: ${department.name}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error(`Department not found: ${errorMessage}`);
      return res.json({
        success: false,
        message: `Department with ID ${departmentId} not found`
      }, 404);
    }

    // Initialize the Graph client with environment variables
    const graphClient = createGraphClient(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );
    
    // Handle potential department name mismatches between Appwrite and M365
    const departmentName = department.name;
    
    log(`Attempting to find users for department: ${departmentName}`);
    
    // Try multiple search strategies to handle name variations
    let allUsers: any[] = [];
    
    // Strategy 1: Try exact match first
    try {
      const exactMatchResponse = await graphClient
        .api('/users')
        .filter(`department eq '${departmentName}'`)
        .select('id,displayName,userPrincipalName,mail,department,jobTitle,businessPhones,mobilePhone')
        .get();
      
      allUsers = exactMatchResponse.value;
      log(`Found ${allUsers.length} users with exact department name match`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`No exact matches found or error occurred: ${errorMessage}`);
    }
    
    // Strategy 2: If no results from exact match, try extracting the last word (e.g., "Karrieredagene" from "OSL Karrieredagene")
    if (allUsers.length === 0 && departmentName.includes(' ')) {
      const baseDepartmentName = departmentName.split(' ').pop() || '';
      
      if (baseDepartmentName) {
        log(`Trying with base department name: ${baseDepartmentName}`);
        
        try {
          const baseNameResponse = await graphClient
            .api('/users')
            .filter(`department eq '${baseDepartmentName}'`)
            .select('id,displayName,userPrincipalName,mail,department,jobTitle,businessPhones,mobilePhone')
            .get();
          
          allUsers = baseNameResponse.value;
          log(`Found ${allUsers.length} users with base department name match`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log(`No base name matches found or error occurred: ${errorMessage}`);
        }
      }
    }
    
    // Strategy 3: If still no results, try a contains search as a last resort
    if (allUsers.length === 0) {
      // Get a significant word from the department name to search for
      // This could be improved with more sophisticated text matching if needed
      const searchTerm = departmentName.split(' ')
        .filter((word: string) => word.length > 3)  // Only use words with more than 3 characters
        .pop() || departmentName;
      
      log(`Trying with partial match search term: ${searchTerm}`);
      
      try {
        const partialMatchResponse = await graphClient
          .api('/users')
          .filter(`contains(department, '${searchTerm}')`)
          .select('id,displayName,userPrincipalName,mail,department,jobTitle,businessPhones,mobilePhone')
          .get();
        
        allUsers = partialMatchResponse.value;
        log(`Found ${allUsers.length} users with partial department name match`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`No partial matches found or error occurred: ${errorMessage}`);
      }
    }
    
    // Return success response with department and users
    return res.json({
      success: true,
      department,
      users: allUsers,
      count: allUsers.length
    });
    
  } catch (err) {
    // Log and return any unexpected errors
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(`Unexpected error: ${errorMessage}`);
    
    return res.json({
      success: false,
      message: 'An unexpected error occurred',
      error: errorMessage
    }, 500);
  }
};