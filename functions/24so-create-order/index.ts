import { Models } from "@biso/appwrite";
import { Customer, soapClient, UserDefinedDimensionKey } from "@biso/twentyfour";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface RequestBody {
    reference: string;
    amount: number;
    description: string;
    membership_id: string;
    membership?: string;
    status: string;
    paid_amount: number;
    user?: Models.Document;
    payment_method: string;
    user_id: string;
    $id: string;
}

const SHOULD_INVOICE = process.env.SHOULD_INVOICE!;
const SHOULD_CREATE_CUSTOMER = process.env.SHOULD_CREATE_CUSTOMER!;

export default async ({ req, res, log, error }: Context) => {
    try {
        log('Parsing request body...');
        log('Request body: ' + JSON.stringify(req.body));

        const body = req.body as RequestBody;
        const { reference, amount, description, membership_id, status, paid_amount, user, payment_method, user_id, $id, membership } = body;

        if (!reference || !amount || !description || !membership_id || !status || !paid_amount || !user || !payment_method || !user_id) {
            log('Missing required parameters');
            return res.json({ error: 'Missing required parameters' });
        }

        if (status !== 'SUCCESS') {
            log('Payment status is not SUCCESS, returning early');
            return res.json({ error: 'Payment status is not SUCCESS' });
        }

        let existingCustomer: Customer | null = null;
        const { createInvoice, getAccessToken, updateCustomerCategory, getCustomer, createCustomer, getCustomerByExternalId } = soapClient(log, error);

        log('Attempting to retrieve access token...');
        const { accessToken, status: tokenStatus } = await getAccessToken();
        if (tokenStatus !== 'ok') {
            log('Failed to retrieve access token');
            return res.json({ error: 'Failed to retrieve access token' });
        }
        log('Token response: ' + JSON.stringify(accessToken));

        const studentId = parseInt(user.student_id.replace('s', ''), 10);

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
            error(`Error during customer retrieval on CompanyId, trying with ExternalId: ${err}`);
            try {
                log(`Attempting to retrieve customer with ExternalId: ${studentId}`);
                response = await getCustomerByExternalId(accessToken, studentId);
                log('Response: ' + JSON.stringify(response));
            } catch (err) {
                error(`Error during customer retrieval on ExternalId: ${err}`);
                // Send a status update for failure
                const membershipType = description;
                const campusName = user.campus.name;
                const status = "Mottatt";
                log('Sending status update to Sharepoint due to customer retrieval failure...');
                await sendStatusUpdateToSharepoint(studentId, `${user.name}`, membershipType.toString(), status, campusName, log, error);
                return res.json({ error: 'Failed to retrieve customer' });
            }
        }

        if (response) {
            existingCustomer = response as Customer;
            log(`Existing customer found for studentId: ${studentId} - ${JSON.stringify(existingCustomer)}`);
        } else if (SHOULD_CREATE_CUSTOMER === 'true') {
            log(`Customer not found for studentId: ${studentId}, creating new customer...`);
            const customerResponse = await createCustomer(accessToken, {
                Name: user.name,
                studentId: studentId.toString(),
                firstName: user.firstName
            });

            if (!customerResponse) {
                log('Failed to create customer');
                return res.json({ error: 'Failed to create customer' });
            }

            existingCustomer = await customerResponse.json() as Customer;
            log(`New customer created with ID: ${existingCustomer.Id} for studentId: ${studentId}`);
        }

        if (!existingCustomer) {
            log(`Customer not found for studentId: ${studentId}, and customer creation is disabled. Exiting early...`);
            const membershipType = description;
            const campusName = user.campus.name;
            const status = "Mottatt";
            log('Sending status update to Sharepoint because customer creation is disabled...');
            await sendStatusUpdateToSharepoint(studentId, `${user.name}`, membershipType.toString(), status, campusName, log, error);
            return res.json({ error: 'Customer not found and creation is disabled' });
        }

        log('Customer found or created successfully, proceeding to update customer category...');
        const departmentId = determineDepartmentId(user.campus.$id);
        const accrualDate = determineAccrualDate();

        let membershipObj: any;
        if (typeof membership === 'string') {
            try {
                membershipObj = JSON.parse(membership);
            } catch (parseError) {
                log('Failed to parse membership string');
                return res.json({ error: 'Invalid membership format' });
            }
        } else {
            membershipObj = membership;
        }

        if (!membershipObj.category || !membershipObj.name) {
            log('Membership object is missing required properties');
            return res.json({ error: 'Invalid membership object' });
        }

        try {
            log('Attempting to update customer category...');
            await updateCustomerCategory(accessToken, membershipObj.category, studentId);
            log('Customer category updated successfully');
        } catch (err) {
            error('Error updating customer category: ' + err);
            return res.json({ error: 'Failed to update customer category' });
        }

        const invoiceStatus = SHOULD_INVOICE === 'true' ? 'Invoiced' : 'Draft';
        const accrualLength = determineAccrualLength(description);

        let invoiceResponse;
        try {
            log(`Attempting to create invoice for studentId: ${studentId}...`);
            invoiceResponse = await createInvoice(accessToken, {
                CustomerId: existingCustomer.Id,
                OrderStatus: invoiceStatus,
                DepartmentId: departmentId,
                IncludeVAT: true,
                PaymentAmount: paid_amount,
                PaymentMethodId: 1,
                PaymentTime: 0,
                UserDefinedDimensions: [
                    {
                        Type: UserDefinedDimensionKey.UserDefined,
                        Name: user.campus.name,
                        Value: user.campus_id,
                        TypeId: '101',
                    },
                    {
                        Type: UserDefinedDimensionKey.UserDefined,
                        Name: membershipObj.name,
                        Value: membershipObj.name,
                        TypeId: '102',
                    },
                ],
                InvoiceRows: [
                    {
                        ProductId: parseInt(membership_id),
                        Price: paid_amount,
                        Quantity: 1,
                    },
                ],
                AccrualDate: accrualDate,
                AccrualLength: accrualLength,
            });
            log('Invoice created successfully: ' + JSON.stringify(invoiceResponse));
        } catch (err) {
            error('Error creating invoice: ' + err);
            const name = existingCustomer.Name;
            const membershipType = description;
            const campusName = user.campus.name;
            const status = "Faktura feilet";
            log('Sending status update to Sharepoint for failed process...');
            await sendStatusUpdateToSharepoint(studentId, name, membershipType.toString(), status, campusName, log, error);
            log('Status update sent successfully');
            return res.json({ error: 'Failed to create invoice' });
        }

        if (invoiceResponse && existingCustomer && membershipObj) {
            const name = existingCustomer.Name;
            const membershipType = description;
            const campusName = user.campus.name;
            const status = SHOULD_INVOICE === "true" ? "Ferdig" : "Faktura opprettet";

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

async function sendStatusUpdateToSharepoint(studentId: number, name: string, membershipType: string, status: string, campusName: string, log: (msg: any) => void, error: (msg: any) => void) {
    try {
        const body = {
            studentId,
            name,
            membershipType,
            status,
            campusName,
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
