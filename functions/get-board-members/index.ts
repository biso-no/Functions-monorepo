import { createAdminClient } from "@biso/appwrite";
import { createGraphClient } from "@biso/m365";

type Context = {
  req: any;
  res: any;
  log: (msg: any) => void;
  error: (msg: any) => void;
};

interface DepartmentMember {
  name: string;
  email: string;
  phone: string;
  role: string;
}

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
    
    // Find the department in the database to get its name
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
    let members: DepartmentMember[] = [];
    
    // Strategy 1: Try exact match first
    try {
      const exactMatchResponse = await graphClient
        .api('/users')
        .filter(`department eq '${departmentName}'`)
        .select('displayName,mail,businessPhones,mobilePhone,jobTitle')
        .get();
      
      if (exactMatchResponse.value.length > 0) {
        members = mapGraphUsersToMembers(exactMatchResponse.value);
        log(`Found ${members.length} users with exact department name match`);
      } else {
        log(`No users found with exact department name: ${departmentName}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`Error with exact match query: ${errorMessage}`);
    }
    
    // Strategy 2: If no results from exact match, try extracting the last word (e.g., "Karrieredagene" from "OSL Karrieredagene")
    if (members.length === 0 && departmentName.includes(' ')) {
      const baseDepartmentName = departmentName.split(' ').pop() || '';
      
      if (baseDepartmentName) {
        log(`Trying with base department name: ${baseDepartmentName}`);
        
        try {
          const baseNameResponse = await graphClient
            .api('/users')
            .filter(`department eq '${baseDepartmentName}'`)
            .select('displayName,mail,businessPhones,mobilePhone,jobTitle')
            .get();
          
          if (baseNameResponse.value.length > 0) {
            members = mapGraphUsersToMembers(baseNameResponse.value);
            log(`Found ${members.length} users with base department name match`);
          } else {
            log(`No users found with base department name: ${baseDepartmentName}`);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log(`Error with base name query: ${errorMessage}`);
        }
      }
    }
    
    // Strategy 3: If still no results, try a contains search as a last resort
    if (members.length === 0) {
      // Get a significant word from the department name to search for
      const searchTerm = departmentName.split(' ')
        .filter((word: string) => word.length > 3)  // Only use words with more than 3 characters
        .pop() || departmentName;
      
      log(`Trying with partial match search term: ${searchTerm}`);
      
      try {
        const partialMatchResponse = await graphClient
          .api('/users')
          .filter(`contains(department, '${searchTerm}')`)
          .select('displayName,mail,businessPhones,mobilePhone,jobTitle')
          .get();
        
        if (partialMatchResponse.value.length > 0) {
          members = mapGraphUsersToMembers(partialMatchResponse.value);
          log(`Found ${members.length} users with partial department name match`);
        } else {
          log(`No users found with partial department name: ${searchTerm}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`Error with partial match query: ${errorMessage}`);
      }
    }
    
    // Return only the department members from M365
    return res.json({
      success: true,
      members: members,
      count: members.length,
      departmentName: departmentName
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

/**
 * Maps users from Graph API response to the DepartmentMember interface
 */
function mapGraphUsersToMembers(graphUsers: any[]): DepartmentMember[] {
  return graphUsers.map(user => ({
    name: user.displayName || '',
    email: user.mail || '',
    phone: getPhoneNumber(user),
    role: user.jobTitle || ''
  }));
}

/**
 * Helper function to get the best available phone number
 */
function getPhoneNumber(user: any): string {
  if (Array.isArray(user.businessPhones) && user.businessPhones.length > 0) {
    return user.businessPhones[0];
  }
  
  if (user.mobilePhone) {
    return user.mobilePhone;
  }
  
  return '';
}