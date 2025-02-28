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
    const { campus, departmentId } = req.body;
    
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
      const officeFilter = `officeLocation eq '${campusInfo.officeFilter}' or contains(officeLocation, '${campusInfo.officeFilter}')`;
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
          const filteredUsers = fallbackResponse.value.filter(user => 
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
          const officeFilter = `officeLocation eq '${campusInfo.officeFilter}' or contains(officeLocation, '${campusInfo.officeFilter}')`;
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
    
    // Strategy 3: If still no results, try a contains search for department
    if (members.length === 0 && departmentName) {
      // Get a significant word from the department name to search for
      const words = departmentName.split(' ');
      const significantWords = words.filter(word => word.length > 3);
      const searchTerm = significantWords.length > 0 ? significantWords[significantWords.length - 1] : departmentName;
      
      log(`Trying with partial match search term: ${searchTerm} and office: ${campusInfo.officeFilter}`);
      
      try {
        const departmentFilter = `contains(department, '${searchTerm}')`;
        const officeFilter = `officeLocation eq '${campusInfo.officeFilter}' or contains(officeLocation, '${campusInfo.officeFilter}')`;
        const combinedFilter = `(${departmentFilter}) and (${officeFilter})`;
        
        const partialMatchResponse = await graphClient
          .api('/users')
          .filter(combinedFilter)
          .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation')
          .get();
        
        if (partialMatchResponse.value && partialMatchResponse.value.length > 0) {
          members = mapGraphUsersToMembers(partialMatchResponse.value, campusInfo.name);
          log(`Found ${members.length} users with partial department name and office match`);
        } else {
          log(`No users found with partial department name and office match`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log(`Error with partial match query: ${errorMessage}`);
      }
    }
    
    // Strategy 4: Last resort - just try to find users in this office with any department
    if (members.length === 0) {
      log(`No users found with department filters. Looking for any users in office: ${campusInfo.officeFilter}`);
      
      try {
        const officeFilter = `officeLocation eq '${campusInfo.officeFilter}' or contains(officeLocation, '${campusInfo.officeFilter}')`;
        
        const officeOnlyResponse = await graphClient
          .api('/users')
          .filter(officeFilter)
          .select('displayName,mail,businessPhones,mobilePhone,jobTitle,officeLocation,department')
          .get();
        
        if (officeOnlyResponse.value && officeOnlyResponse.value.length > 0) {
          // Sort users with departments similar to what we're looking for to the top
          const sortedUsers = officeOnlyResponse.value.sort((a, b) => {
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