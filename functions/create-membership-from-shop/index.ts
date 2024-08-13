import { Models } from "@biso/appwrite";
import { Customer, customer, salesOrder, Status, soapClient, UserDefinedDimensionKey } from "@biso/twentyfour";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface RequestBody {
    customer: any;
    snumber: string;
    selected_variation: string;
    price: string;
}

const SHOULD_INVOICE = process.env.SHOULD_INVOICE!;
const SHOULD_CREATE_CUSTOMER = process.env.SHOULD_CREATE_CUSTOMER!;

export default async ({ req, res, log, error }: Context) => {
    try {
        log('Parsing request body...');
        log('Request body: ' + JSON.stringify(req.body));

        const body = req.body as RequestBody;
        const { customer, snumber, selected_variation, price } = body;

        if (!customer || !snumber || !selected_variation) {
            error('Missing required parameters: customer, snumber, or selected_variation');
            return res.json({ error: 'Missing required parameters' });
        }

        const shouldCreateCustomer = SHOULD_CREATE_CUSTOMER === 'true';
        let existingCustomer: Customer | null = null;
        const { createInvoice, getAccessToken, updateCustomerCategory, getCustomer, createCustomer } = soapClient(log, error);

        log('Attempting to retrieve access token...');
        const { accessToken, status: tokenStatus } = await getAccessToken();
        if (tokenStatus !== 'ok') {
            log('Failed to retrieve access token');
            return res.json({ error: 'Failed to retrieve access token' });
        }
        log('Token response: ' + JSON.stringify(accessToken));

        const cleanedSnumber = snumber.replace(/[^0-9]/g, ''); // Remove all non-numeric characters
        const studentId = parseInt(cleanedSnumber, 10); // Convert the cleaned string to an integer
        
        if (isNaN(studentId)) {
            error('Invalid student number format');
            return res.json({ error: 'Invalid student number format' });
        }
        
        let response;
        try {
            log(`Attempting to retrieve customer with studentId: ${studentId}`);
            response = await getCustomer(accessToken, studentId);
            log('Response: ' + JSON.stringify(response));
        } catch (err) {
            error(`Error during customer retrieval: ${err}`);
            const membershipType = campusMapping[selected_variation].type;
            const campusName = campusMapping[selected_variation].name;
            const status = "Mottatt";
            log('Sending status update to Sharepoint due to customer retrieval failure...');
            await sendStatusUpdateToSharepoint(studentId, `${customer.first_name} ${customer.last_name}`, membershipType.toString(), status, campusName, log, error);
            return res.json({ error: 'Failed to retrieve customer' });
        }

        if (response) {
            existingCustomer = response as Customer;
            log(`Existing customer found for snumber: ${snumber} - ${JSON.stringify(existingCustomer)}`);
        } else if (shouldCreateCustomer) {
            log(`Customer not found for snumber: ${snumber}, creating new customer...`);
            const customerResponse = await createCustomer(accessToken, {
                Name: `${customer.first_name} ${customer.last_name}`,
                studentId: snumber,
                firstName: customer.first_name
            });

            if (!customerResponse) {
                log('Failed to create customer');
                return res.json({ error: 'Failed to create customer' });
            }

            existingCustomer = await customerResponse.json() as Customer;
            log(`New customer created with ID: ${existingCustomer.Id} for snumber: ${studentId}`);
        }

        if (!shouldCreateCustomer && !existingCustomer) {
            log(`Customer not found for snumber: ${snumber}, and SHOULD_CREATE_CUSTOMER is false. Exiting early...`);
            const membershipType = campusMapping[selected_variation].type;
            const campusName = campusMapping[selected_variation].name;
            const status = "Mottatt";
            log('Sending status update to Sharepoint because customer creation is disabled...');
            await sendStatusUpdateToSharepoint(studentId, `${customer.first_name} ${customer.last_name}`, membershipType.toString(), status, campusName, log, error);
            return res.json({ error: 'Customer not found and creation is disabled' });
        }

        log('Customer found or created successfully, proceeding to update customer category...');
        const campus = determineCampusId(selected_variation);
        const departmentId = determineDepartmentId(campus.campus_id);
        const accrualDate = determineAccrualDate();


        const membershipObj = {
            customerId: existingCustomer?.Id || studentId,
            membershipId: selected_variation,
            category: categoryMapping[selected_variation],
            name: campusMapping[selected_variation].type,
        };

        try {
            log('Attempting to update customer category...');
            await updateCustomerCategory(accessToken, membershipObj.category, studentId);
            log('Customer category updated successfully');
        } catch (err) {
            error('Error updating customer category: ' + err);
            return res.json({ error: 'Failed to update customer category' });
        }

        const invoiceStatus = SHOULD_INVOICE === 'true' ? 'Invoiced' : 'Draft';
        const accrualLength = determineAccrualLength(campusMapping[selected_variation].type);

        const userCampus = {
            campus: determineCampusId(selected_variation),
            name: campusMapping[selected_variation].name,
        };

        //Current date in format YYYY-MM-DD
        const currentDate = new Date().toISOString().split('T')[0];

        let invoiceResponse;
        if (existingCustomer && membershipObj) {
        try {
            const invoiceBody = {
                CustomerId: existingCustomer.Id,
                OrderStatus: invoiceStatus,
                DepartmentId: departmentId,
                IncludeVAT: true,
                PaymentAmount: parseFloat(price),
                DateInvoiced: currentDate,
                PaymentMethodId: 1,
                PaymentTime: 0,
                UserDefinedDimensions: [
                    {
                        Type: UserDefinedDimensionKey.UserDefined,
                        Name: userCampus.name,
                        TypeId: '101',
                    },
                    {
                        Type: UserDefinedDimensionKey.UserDefined,
                        Name: membershipObj.name,
                        TypeId: '102',
                    },
                ],
                InvoiceRows: [
                    {
                        ProductId: parseInt(variationToProductIdMapping[selected_variation]),
                        Price: parseFloat(price),
                        Quantity: 1,
                    },
                ],
                AccrualDate: accrualDate,
                AccrualLength: accrualLength,
            };

            log(`Attempting to create invoice for customerId: ${studentId}...`);
            log('Invoice body: ' + JSON.stringify(invoiceBody));
            invoiceResponse = await createInvoice(accessToken, invoiceBody);
            log('Invoice created successfully: ' + JSON.stringify(invoiceResponse));
        } catch (err) {
            error('Error creating invoice: ' + err);
            const name = existingCustomer.Name;
            const membershipType = campusMapping[selected_variation].type;
            const campusName = campusMapping[selected_variation].name;
            const status = "Faktura feilet";
            log('Sending status update to Sharepoint for failed process...');
            await sendStatusUpdateToSharepoint(studentId, name, membershipType.toString(), status, campusName, log, error);
            log('Status update sent successfully');
            return res.json({ error: 'Failed to create invoice' });
        }
        }

        if (invoiceResponse && existingCustomer && membershipObj) {
            const name = existingCustomer.Name;
            const membershipType = campusMapping[selected_variation].type;
            const campusName = campusMapping[selected_variation].name;
            const status = "Faktura opprettet";

            log('Sending status update to Sharepoint for completed process...');
            await sendStatusUpdateToSharepoint(studentId, name, membershipType.toString(), status, campusName, log, error);
            log('Status update sent successfully');
        }

        return res.json({ success: 'Process completed successfully' });
    } catch (err) {
        error(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return res.json({ error: 'An unexpected error occurred' });
    }
};


// Utility function to determine department ID based on campus ID
function determineDepartmentId(campusId: string): number {
    switch (campusId) {
        case '1':
            return 1;
        case '2':
            return 300;
        case '3':
            return 600;
        case '4':
            return 800;
        default:
            return 1000; // Default to National
    }
}

function determineAccrualDate(): string {
    const currentDate = new Date();
    let accrualDate: Date;

    // Determine the accrual date based on the purchase time of the year
    if (currentDate.getMonth() >= 6) { // July or later (July is month 6)
        accrualDate = new Date(currentDate.getFullYear(), 6, 1); // July 1st of the current year
    } else { // January through June
        accrualDate = new Date(currentDate.getFullYear(), 5, 1); // June 1st of the current year
    }

    const yyyy = accrualDate.getFullYear();
    const mm = String(accrualDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
    const dd = String(accrualDate.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
}







async function sendStatusUpdateToSharepoint(studentId: number, name: string, membershipType: string, status: string, campusName: string, log: (msg: any) => void, error: (msg: any) => void) {
    try {
        const body = {
            studentId,
            name,
            membershipType,
            status,
            campusName, // Including the campus name in the request body
        };
        log(`Sending status update to Sharepoint: ${JSON.stringify(body)}`);
        const response = await fetch(`https://prod-62.westeurope.logic.azure.com:443/workflows/0292362fa91b46ef9d59267886f6a3a4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=J3pmj_cNjprnZeK9KJop0UjD9lcPms_L6Olz4OTDch4`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        log(`Status update sent successfully: ${JSON.stringify(data)}`);
    } catch (err) {
        if (err instanceof Error) {
            error(`Failed to send status update: ${err.message}`);
        } else {
            error('Failed to send status update: An unknown error occurred');
        }
    }
}


const campusMapping: { [key: string]: { campus_id: string, name: string, type: string } } = {
    '22141': { campus_id: '1', name: 'Oslo', type: 'Semester' },
    '22145': { campus_id: '1', name: 'Oslo', type: 'Year' },
    '22149': { campus_id: '1', name: 'Oslo', type: '3 Years' },
    '22142': { campus_id: '2', name: 'Bergen', type: 'Semester' },
    '22146': { campus_id: '2', name: 'Bergen', type: 'Year' },
    '22150': { campus_id: '2', name: 'Bergen', type: '3 Years' },
    '22143': { campus_id: '3', name: 'Trondheim', type: 'Semester' },
    '22147': { campus_id: '3', name: 'Trondheim', type: 'Year' },
    '22151': { campus_id: '3', name: 'Trondheim', type: '3 Years' },
    '22144': { campus_id: '4', name: 'Stavanger', type: 'Semester' },
    '22148': { campus_id: '4', name: 'Stavanger', type: 'Year' },
    '22152': { campus_id: '4', name: 'Stavanger', type: '3 Years' },
};


// Utility function to determine accrual length based on membership type
function determineAccrualLength(membershipType: string): number {
    switch (membershipType.toLowerCase()) {
        case 'semester':
            return 6; // 6 months
        case 'year':
            return 12; // 12 months
        case '3 years':
            return 36; // 36 months
        default:
            throw new Error('Invalid membership type');
    }
}

function determineCampusId(selected_variation: string): { campus_id: string, name: string } {
    const campus = campusMapping[selected_variation];
    return { campus_id: campus.campus_id, name: campus.name };
}

const categoryMapping: { [key: string]: number } = {
    '22141': 113170, // Semester
    '22142': 113170,
    '22143': 113170,
    '22144': 113170,
    '22145': 113172, // 2 years
    '22146': 113172,
    '22147': 113172,
    '22148': 113172,
    '22149': 113171, // 3 years
    '22150': 113171,
    '22151': 113171,
    '22152': 113171,
};

/*
    '22141': { campus_id: '1', name: 'Oslo', type: 'Semester' },
    '22145': { campus_id: '1', name: 'Oslo', type: 'Year' },
    '22149': { campus_id: '1', name: 'Oslo', type: '3 Years' },
    '22142': { campus_id: '2', name: 'Bergen', type: 'Semester' },
    '22146': { campus_id: '2', name: 'Bergen', type: 'Year' },
    '22150': { campus_id: '2', name: 'Bergen', type: '3 Years' },
    '22143': { campus_id: '3', name: 'Trondheim', type: 'Semester' },
    '22147': { campus_id: '3', name: 'Trondheim', type: 'Year' },
    '22151': { campus_id: '3', name: 'Trondheim', type: '3 Years' },
    '22144': { campus_id: '4', name: 'Stavanger', type: 'Semester' },
    '22148': { campus_id: '4', name: 'Stavanger', type: 'Year' },
    '22152': { campus_id: '4', name: 'Stavanger', type: '3 Years' },
    */

const variationToProductIdMapping: { [key: string]: string } = {
    '22141': '50', // Semester
    '22142': '50',
    '22143': '50',
    '22144': '50',
    '22145': '69', // 2 years
    '22146': '69',
    '22147': '69',
    '22148': '69',
    '22149': '80', // 3 years
    '22150': '80',
    '22151': '80',
    '22152': '80',
};