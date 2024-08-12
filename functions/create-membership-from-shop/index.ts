import { Models } from "@biso/appwrite";
import { Customer, customer, salesOrder, Status, soapClient, UserDefinedDimensionKey } from "@biso/twentyfour";
import {phpUnserialize} from 'phpunserialize'; // Assuming you have a package like `phpunserialize` to parse the PHP serialized strings.

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface RequestBody {
    customer: any;
    custom_field_value: string;
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
        const { customer, custom_field_value, selected_variation, price } = body;

        // Extracting student_id from custom_field_value
        let student_id = '';
        try {
            const parsedValue = phpUnserialize(custom_field_value); // Use phpUnserialize to parse the PHP serialized string
            if (typeof parsedValue === 'object' && parsedValue !== null && 'fields' in parsedValue) {
                student_id = parsedValue.fields[0].value;
            } else {
                throw new Error('Invalid format');
            }
        } catch (parseError) {
            error('Error parsing custom_field_value: ' + parseError);
            return res.json({ error: 'Invalid custom_field_value format' });
        }

        log(`Parsed request body: ${JSON.stringify(body)}`);

        if (!customer || !student_id || !selected_variation) {
            error('Missing required parameters: customer, student_id, or selected_variation');
            return res.json({ error: 'Missing required parameters' });
        }

        const shouldCreateCustomer = SHOULD_CREATE_CUSTOMER === 'true';
        let existingCustomer: Customer | null = null;
        const { createInvoice, getAccessToken, updateCustomerCategory, getCustomer, createCustomer } = soapClient(log, error);

        const { accessToken, status: tokenStatus } = await getAccessToken();
        if (tokenStatus !== 'ok') {
            log('Failed to retrieve access token');
            return res.json({ error: 'Failed to retrieve access token' });
        }
        log('Token response: ' + JSON.stringify(accessToken));

        const studentId = parseInt(student_id.replace('s', ''), 10);
        let response;
        try {
            response = await getCustomer(accessToken, studentId);
            log('Response: ' + JSON.stringify(response));
        } catch (err) {
            error(`Error during customer retrieval: ${err}`);
            const membershipType = campusMapping[selected_variation].type;
            const campusName = campusMapping[selected_variation].name;
            const status = "Mottatt";
            await sendStatusUpdateToSharepoint(studentId, `${customer.first_name} ${customer.last_name}`, membershipType.toString(), status, campusName, log, error);
            return res.json({ error: 'Failed to retrieve customer' });
        }

        if (response) {
            existingCustomer = response as Customer;
            log(`Existing customer found for user_id: ${student_id} - ${JSON.stringify(existingCustomer)}`);
        } else if (shouldCreateCustomer) {
            log(`Customer not found for user_id: ${student_id}, creating new customer...`);
            const customerResponse = await createCustomer(accessToken, {
                $id: student_id,
                name: `${customer.first_name} ${customer.last_name}`,
                firstName: customer.first_name,
                lastName: customer.last_name,
            });

            if (!customerResponse) {
                log('Failed to create customer');
                return res.json({ error: 'Failed to create customer' });
            }

            existingCustomer = await customerResponse.json() as Customer;
            log(`New customer created with ID: ${existingCustomer.Id} for user_id: ${studentId}`);
        }

        if (!shouldCreateCustomer && !existingCustomer) {
            log(`Customer not found for user_id: ${student_id}, and SHOULD_CREATE_CUSTOMER is false. Exiting early...`);
            const membershipType = campusMapping[selected_variation].type;
            const campusName = campusMapping[selected_variation].name;
            const status = "Mottatt";
            await sendStatusUpdateToSharepoint(studentId, `${customer.first_name} ${customer.last_name}`, membershipType.toString(), status, campusName, log, error);
            return res.json({ error: 'Customer not found and creation is disabled' });
        }

        const campus = determineCampusId(selected_variation);
        const departmentId = determineDepartmentId(campus.campus_id);
        const accrualDate = determineAccrualDate();

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

        const membershipObj = {
            customerId: existingCustomer?.Id || studentId,
            membershipId: selected_variation,
            category: categoryMapping[selected_variation],
            name: campusMapping[selected_variation].type,
        };

        try {
            await updateCustomerCategory(accessToken, membershipObj.category, studentId);
        } catch (err) {
            log('Error updating customer category');
            return res.json({ error: 'Failed to update customer category' });
        }

        const invoiceStatus = SHOULD_INVOICE === 'true' ? 'Invoiced' : 'Draft';
        const accrualLength = determineAccrualLength(campusMapping[selected_variation].type);

        const userCampus = {
            campus: determineCampusId(selected_variation),
            name: `${customer.first_name} ${customer.last_name}`,
        };

        let invoiceResponse;
        try {
            invoiceResponse = await createInvoice(accessToken, {
                CustomerId: studentId,
                OrderStatus: invoiceStatus,
                DepartmentId: departmentId,
                IncludeVAT: true,
                PaymentAmount: parseFloat(price),
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
                        ProductId: parseInt(membershipObj.membershipId),
                        Price: parseFloat(price),
                        Quantity: 1,
                    },
                ],
                AccrualDate: accrualDate,
                AccrualLength: accrualLength,
            });
            log('Invoice response: ' + JSON.stringify(invoiceResponse));
        } catch (err) {
            log('Error creating invoice');
            return res.json({ error: 'Failed to create invoice' });
        }

        if (invoiceResponse && existingCustomer && membershipObj) {
            const name = existingCustomer.Name;
            const membershipType = membershipObj.category;
            const campusName = campusMapping[selected_variation].name;
            const status = "Ferdig";

            await sendStatusUpdateToSharepoint(studentId, name, membershipType.toString(), status, campusName, log, error);
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
    if (currentDate.getMonth() >= 6) { // July or later (fall)
        accrualDate = new Date(currentDate.getFullYear() + 1, 6, 1); // July 1st of next year
    } else { // January through June
        accrualDate = new Date(currentDate.getFullYear(), 0, 1); // January 1st of this year
    }

    const yyyy = accrualDate.getFullYear();
    const mm = String(accrualDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
    const dd = String(accrualDate.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
}

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

function determineCampusId(selected_variation: string): { campus_id: string, name: string } {
    const campus = campusMapping[selected_variation];
    return { campus_id: campus.campus_id, name: campus.name };
}

async function sendStatusUpdateToSharepoint(studentId: number, name: string, membershipType: string, status: string, campusName: string, log: (msg: any) => void, error: (msg: any) => void) {
    try {
        const response = await fetch(`https://prod-62.westeurope.logic.azure.com:443/workflows/0292362fa91b46ef9d59267886f6a3a4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=J3pmj_cNjprnZeK9KJop0UjD9lcPms_L6Olz4OTDch4`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                studentId,
                name,
                membershipType,
                status,
                campusName, // Including the campus name in the request body
            }),
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
