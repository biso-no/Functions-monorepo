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
  officeLocation: string;
  profilePhotoUrl?: string;
}

interface CampusMapping {
  id: string;
  name: string;
  defaultDepartment: string;
  officeFilter: string; // The value to look for in officeLocation
}

export default async ({ req, res, log, error }: Context) => {
  try {
    // Get campus and optional departmentId from request body
    let requestBody;
    try {
      requestBody = JSON.parse(req.body);
    } catch (e) {
      requestBody = req.body; // If already parsed
    }
    
    const { campus, departmentId } = requestBody;
    
    // Validate campus parameter
    if (!campus) {
      return res.json({
        success: false,
        message: 'Missing required parameter: campus is required'
      }, 400);
    }

    log(`Processing request for campus ${campus}${departmentId ? ` and department ${departmentId}` : ''}`);
    
    // Initialize Appwrite admin client
    const { databases } = await createAdminClient();
    
    // Define campus mappings with office filters
    const campusMappings: CampusMapping[] = [
      { id: "1", name: "Oslo", defaultDepartment: "Campus Management", officeFilter: "Oslo" },
      { id: "2", name: "Bergen", defaultDepartment: "Campus Management", officeFilter: "Bergen" },
      { id: "3", name: "Trondheim", defaultDepartment: "Campus Management", officeFilter: "Trondheim" },
      { id: "4", name: "Stavanger", defaultDepartment: "Campus Management", officeFilter: "Stavanger" },
      { id: "5", name: "National", defaultDepartment: "Operations Unit", officeFilter: "National" }
    ];
    
    // Get campus information
    const campusInfo = campusMappings.find(c => c.id === campus) || 
                      { id: campus, name: "Unknown", defaultDepartment: "Campus Management", officeFilter: "Unknown" };

    // If no departmentId provided, use the default department for this campus
    let departmentName = "";
    
    if (departmentId) {
      // Department ID provided - look it up in the database
      try {
        const department = await databases.getDocument('app', 'departments', departmentId);
        departmentName = department.name || "";
        
        if (!departmentName) {
          log(`Warning: Department found but has no name. Using ID as fallback.`);
          departmentName = departmentId;
        } else {
          log(`Found department: ${departmentName}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        error(`Department not found: ${errorMessage}`);
        return res.json({
          success: false,
          message: `Department with ID ${departmentId} not found`
        }, 404);
      }
    } else {
      // No department ID provided - use campus default
      departmentName = campusInfo.defaultDepartment;
      log(`No department ID provided. Using campus default: ${departmentName}`);
    }

    // Initialize the Graph client with environment variables
    const graphClient = createGraphClient(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );
    
    log(`Attempting to find users for department: ${departmentName} in office: ${campusInfo.name}`);
    
    // Try multiple search strategies to handle name variations
    let members: DepartmentMember[] = [];
    
    // Strategy 1: Get all users and filter client-side - most compatible approach
    try {
      log(`Getting all users and filtering client-side for department: "${departmentName}" and office: "${campusInfo.name}"`);
      
      // Get all users with their key properties
      const allUsersResponse = await graphClient
        .api('/users')
        .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation,department')
        .top(999) // Get as many users as possible (max 999)
        .get();
      
      if (allUsersResponse.value && allUsersResponse.value.length > 0) {
        log(`Retrieved ${allUsersResponse.value.length} total users, filtering now...`);
        
        // Filter client-side
        const filteredUsers = allUsersResponse.value.filter((user: any) => {
          // Check if user has the required department
          const hasDepartment = 
            user.department && 
            (user.department === departmentName || 
             user.department.toLowerCase().includes(departmentName.toLowerCase()) || 
             departmentName.toLowerCase().includes(user.department.toLowerCase()));
          
          // Check if user has the required office location
          const hasOffice = 
            user.officeLocation && 
            (user.officeLocation === campusInfo.name || 
             user.officeLocation.toLowerCase().includes(campusInfo.name.toLowerCase()) || 
             campusInfo.name.toLowerCase().includes(user.officeLocation.toLowerCase()));
          
          return hasDepartment && hasOffice;
        });
        
        if (filteredUsers.length > 0) {
          members = await mapGraphUsersToMembers(filteredUsers, campusInfo.name, graphClient);
          log(`Found ${members.length} matching users after client-side filtering`);
        } else {
          log(`No matching users found after client-side filtering`);
          
          // Try a more lenient approach with just the department
          log(`Trying more lenient approach: just checking department"`);
          
          const departmentUsers = allUsersResponse.value.filter((user: any) => {
            const hasDepartment = 
              user.department && 
              (user.department === departmentName || 
               user.department.toLowerCase().includes(departmentName.toLowerCase()) || 
               departmentName.toLowerCase().includes(user.department.toLowerCase()));
            
            return hasDepartment;
          });
          
          if (departmentUsers.length > 0) {
            members = await mapGraphUsersToMembers(departmentUsers, campusInfo.name, graphClient);
            log(`Found ${members.length} users with matching department`);
          } else {
            log(`No users found with matching department`);
          }
        }
      } else {
        log(`No users retrieved from Graph API`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error(`Error querying users: ${errorMessage}`);
    }
    
    // If still no results, try with just the basic department and office queries
    if (members.length === 0) {
      try {
        log(`Trying with simple eq filter for exact department: "${departmentName}"`);
        
        const exactMatchResponse = await graphClient
          .api('/users')
          .filter(`department eq '${departmentName}'`)
          .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation')
          .get();
        
        if (exactMatchResponse.value && exactMatchResponse.value.length > 0) {
          // Filter client-side for office
          const officeUsers = exactMatchResponse.value.filter((user: any) => 
            user.officeLocation && user.officeLocation.toLowerCase().includes(campusInfo.name.toLowerCase())
          );
          
          members = await mapGraphUsersToMembers(officeUsers.length > 0 ? officeUsers : exactMatchResponse.value, campusInfo.name, graphClient);
          log(`Found ${members.length} users with exact department match`);
        } else {
          log(`No users found with exact department match: ${departmentName}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`Error with exact match query: ${errorMessage}`);
      }
    }
    
    // Return department members from M365
    if (members.length > 0) {
      return res.json({
        success: true,
        members: members,
        count: members.length,
        departmentName: departmentName,
        campus: campusInfo.name
      });
    } else {
      // Last resort - if we couldn't find any users, return an empty array with a helpful message
      log("No members found using any search strategy");
      
      return res.json({
        success: true,
        members: [],
        count: 0,
        departmentName: departmentName,
        campus: campusInfo.name,
        message: `No users found for ${departmentName} in ${campusInfo.name}`
      });
    }
    
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
 * and fetches profile photos for each user
 */
async function mapGraphUsersToMembers(graphUsers: any[], defaultOffice: string, graphClient: any): Promise<DepartmentMember[]> {
  if (!Array.isArray(graphUsers)) {
    return [];
  }
  
  // First map the basic user data
  const members: DepartmentMember[] = graphUsers.map(user => ({
    name: user.displayName || '',
    email: user.mail || '',
    phone: getPhoneNumber(user),
    role: user.jobTitle || '',
    officeLocation: user.officeLocation || defaultOffice
  }));
  
  // Then fetch profile photos for users with email addresses
  for (let i = 0; i < members.length; i++) {
    if (members[i].email) {
      try {
        // Get the photo as a data URL
        const photoResponse = await graphClient
          .api(`/users/${members[i].email}/photo/$value`)
          .get();
        
        if (photoResponse) {
          // Convert the binary data to a Base64 string
          const base64Photo = Buffer.from(photoResponse).toString('base64');
          members[i].profilePhotoUrl = `data:image/jpeg;base64,${base64Photo}`;
        }
      } catch (err) {
        // Skip if photo not available
        console.log(`No photo available for user: ${members[i].email}`);
      }
    }
  }
  
  return members;
}

/**
 * Helper function to get the best available phone number
 */
function getPhoneNumber(user: any): string {
  if (!user) {
    return '';
  }
  
  if (Array.isArray(user.businessPhones) && user.businessPhones.length > 0) {
    return user.businessPhones[0];
  }
  
  if (user.mobilePhone) {
    return user.mobilePhone;
  }
  
  return '';
}