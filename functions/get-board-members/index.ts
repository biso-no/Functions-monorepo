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
    
    log(`Attempting to find users for department: ${departmentName} in office: ${campusInfo.officeFilter}`);
    
    // Try multiple search strategies to handle name variations
    let members: DepartmentMember[] = [];
    
    // Strategy 1: Try exact match first with office filter
    try {
      // Filter by both department and office location
      const departmentFilter = `department eq '${departmentName}'`;
      
      // Use a simpler office filter since 'contains' isn't supported on all deployments
      const officeFilter = `officeLocation eq '${campusInfo.officeFilter}'`;
      const combinedFilter = `(${departmentFilter}) and (${officeFilter})`;
      
      log(`Using filter: ${combinedFilter}`);
      
      const exactMatchResponse = await graphClient
        .api('/users')
        .filter(combinedFilter)
        .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation')
        .get();
      
      if (exactMatchResponse.value && exactMatchResponse.value.length > 0) {
        members = mapGraphUsersToMembers(exactMatchResponse.value, campusInfo.name);
        log(`Found ${members.length} users with exact department and office match`);
      } else {
        log(`No users found with exact department and office match`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`Error with exact match query: ${errorMessage}`);
      
      // Fallback: Try just department filter if the combined filter fails
      try {
        const departmentFilter = `department eq '${departmentName}'`;
        
        log(`Falling back to department-only filter: ${departmentFilter}`);
        
        const fallbackResponse = await graphClient
          .api('/users')
          .filter(departmentFilter)
          .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation')
          .get();
        
        if (fallbackResponse.value && fallbackResponse.value.length > 0) {
          // Filter the results client-side to match the office
          const filteredUsers = fallbackResponse.value.filter((user: { officeLocation: string | string[]; }) => 
            user.officeLocation && 
            (user.officeLocation === campusInfo.officeFilter || 
             user.officeLocation.includes(campusInfo.officeFilter))
          );
          
          members = mapGraphUsersToMembers(filteredUsers, campusInfo.name);
          log(`Found ${members.length} users after client-side filtering for office`);
        }
      } catch (fallbackErr) {
        log(`Fallback query also failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
      }
    }
    
    // Strategy 2: If no results, try with base department name
    if (members.length === 0 && departmentName && departmentName.includes(' ')) {
      const parts = departmentName.split(' ');
      const baseDepartmentName = parts.length > 0 ? parts[parts.length - 1] : '';
      
      if (baseDepartmentName) {
        log(`Trying with base department name: ${baseDepartmentName} and office: ${campusInfo.officeFilter}`);
        
        try {
          const departmentFilter = `department eq '${baseDepartmentName}'`;
          const officeFilter = `officeLocation eq '${campusInfo.officeFilter}'`;
          const combinedFilter = `(${departmentFilter}) and (${officeFilter})`;
          
          const baseNameResponse = await graphClient
            .api('/users')
            .filter(combinedFilter)
            .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation')
            .get();
          
          if (baseNameResponse.value && baseNameResponse.value.length > 0) {
            members = mapGraphUsersToMembers(baseNameResponse.value, campusInfo.name);
            log(`Found ${members.length} users with base department name and office match`);
          } else {
            log(`No users found with base department name and office match`);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log(`Error with base name query: ${errorMessage}`);
        }
      }
    }
    
    // Strategy 3: If still no results, try all users and filter client-side
    if (members.length === 0 && departmentName) {
      log(`No users found with API filters. Getting all users and filtering client-side`);
      
      try {
        const response = await graphClient
          .api('/users')
          .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation,department')
          .get();
        
        if (response.value && response.value.length > 0) {
          const filteredUsers = response.value.filter((user: { department: string; officeLocation: string; }) => {
            if (!user.department || !user.officeLocation) return false;
            
            const hasDepartment = user.department.toLowerCase().includes(departmentName.toLowerCase()) || 
                                  departmentName.toLowerCase().includes(user.department.toLowerCase());
                                  
            const hasOffice = user.officeLocation.toLowerCase().includes(campusInfo.officeFilter.toLowerCase()) || 
                              campusInfo.officeFilter.toLowerCase().includes(user.officeLocation.toLowerCase());
                              
            return hasDepartment && hasOffice;
          });
          
          members = mapGraphUsersToMembers(filteredUsers, campusInfo.name);
          log(`Found ${members.length} users with client-side filtering`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`Error getting all users: ${errorMessage}`);
      }
    }
    
    // Strategy 4: Last resort - just try to find users in this office with any department
    if (members.length === 0) {
      log(`No users found with department filters. Looking for any users in office: ${campusInfo.officeFilter}`);
      
      try {
        const officeFilter = `officeLocation eq '${campusInfo.officeFilter}'`;
        
        const officeOnlyResponse = await graphClient
          .api('/users')
          .filter(officeFilter)
          .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation,department')
          .get();
        
        if (officeOnlyResponse.value && officeOnlyResponse.value.length > 0) {
          // Sort users with departments similar to what we're looking for to the top
          const sortedUsers = officeOnlyResponse.value.sort((a: { department: any; }, b: { department: any; }) => {
            const aDept = (a.department || '').toLowerCase();
            const bDept = (b.department || '').toLowerCase();
            const targetDept = departmentName.toLowerCase();
            
            // If one has the target department and the other doesn't
            if (aDept.includes(targetDept) && !bDept.includes(targetDept)) return -1;
            if (!aDept.includes(targetDept) && bDept.includes(targetDept)) return 1;
            
            // Alphabetically by department otherwise
            return aDept.localeCompare(bDept);
          });
          
          members = mapGraphUsersToMembers(sortedUsers, campusInfo.name);
          log(`Found ${members.length} users in the office location`);
        } else {
          log(`No users found in office location: ${campusInfo.officeFilter}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`Error with office-only query: ${errorMessage}`);
      }
    }
    
    // Add profile photos to members if requested
    if (members.length > 0) {
      await addProfilePhotos(members, graphClient, log);
    }
    
    // Return only the department members from M365
    return res.json({
      success: true,
      members: members,
      count: members.length,
      departmentName: departmentName,
      campus: campusInfo.name
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
function mapGraphUsersToMembers(graphUsers: any[], defaultOffice: string): DepartmentMember[] {
  if (!Array.isArray(graphUsers)) {
    return [];
  }
  
  return graphUsers.map(user => ({
    name: user.displayName || '',
    email: user.mail || '',
    phone: getPhoneNumber(user),
    role: user.jobTitle || '',
    officeLocation: user.officeLocation || defaultOffice
  }));
}

/**
 * Add profile photos to users in a separate step
 * This approach keeps the original member search logic intact and just adds photos after
 */
async function addProfilePhotos(members: DepartmentMember[], graphClient: any, log: (msg: any) => void): Promise<void> {
  log(`Attempting to fetch profile photos for ${members.length} members`);
  
  for (let i = 0; i < members.length; i++) {
    if (members[i].email) {
      try {
        // Fetch photo
        const photoResponse = await graphClient
          .api(`/users/${members[i].email}/photo/$value`)
          .get();
        
        if (photoResponse) {
          // Convert the binary data to a Base64 string
          const base64Photo = Buffer.from(photoResponse).toString('base64');
          members[i].profilePhotoUrl = `data:image/jpeg;base64,${base64Photo}`;
          log(`Successfully fetched photo for ${members[i].name}`);
        }
      } catch (err) {
        // Just skip this photo and continue
        log(`No photo available for user: ${members[i].email}`);
      }
    }
  }
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