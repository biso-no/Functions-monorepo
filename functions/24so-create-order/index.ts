import { Models } from "@biso/appwrite";
import { Customer, customer, salesOrder, Status, soapClient, UserDefinedDimensionKey } from "@biso/twentyfour";

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

const SHOULD_INVOICE = process.env.SHOULD_INVOICE!

export default async ({ req, res, log, error }: Context) => {
        log('Parsing request body...');
        log('Request body: ' + JSON.stringify(req.body));

        // Use the req.body directly as it is already an object
        const body = req.body as RequestBody;

        const { reference, amount, description, membership_id, status, paid_amount, user, payment_method, user_id, $id, membership } = body;

        log(`Parsed request body: ${JSON.stringify(body)}`);

        if (!reference || !amount || !description || !membership_id || !status || !paid_amount || !user || !payment_method || !user_id || !membership) {
            log('Missing required parameters');
            return res.json({ error: 'Missing required parameters' });
        }

        let existingCustomer: Customer | null = null;
        const { createInvoice, getAccessToken, updateCustomerCategory, getCustomer, createCustomer } = soapClient();
        const { accessToken, status: tokenStatus } = await getAccessToken();
        if (tokenStatus !== 'ok') {
            log('Failed to retrieve access token');
            return res.json({ error: 'Failed to retrieve access token' });
        }
        log('Token response: ' + JSON.stringify(accessToken));
        const studentId = parseInt(user.student_id.replace('s', ''));
        const response = await getCustomer(accessToken, studentId);
        log('Response: ' + JSON.stringify(response));
        if (response) {
            existingCustomer = await response as Customer;
            log(`Existing customer found for user_id: ${user_id} - ${JSON.stringify(existingCustomer)}`);
        } else {
            log(`Customer not found for user_id: ${user_id}, creating new customer...`);
            const customerResponse = await createCustomer(accessToken, user);

            if (!customerResponse) {
                log('Failed to create customer');
                return res.json({ error: 'Failed to create customer' });
            }

            existingCustomer = await customerResponse.json() as Customer;
            log(`New customer created with ID: ${existingCustomer.Id} for user_id: ${user_id}`);
        }

        const departmentId = determineDepartmentId(user.campus.$id);
        const accrualDate = determineAccrualDate();
        const accrualLength = 6;

        // Check if membership is a string and parse it, otherwise assume it's already an object
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

        // Ensure membershipObj has the expected properties
        if (!membershipObj.category || !membershipObj.name) {
            log('Membership object is missing required properties');
            return res.json({ error: 'Invalid membership object' });
        }

        const customerCategoryId = await updateCustomerCategory(accessToken, membershipObj.category, studentId);

        const invoiceStatus = SHOULD_INVOICE === 'true' ? 'Invoiced' : 'Draft';

        const invoiceResponse = await createInvoice(accessToken, {
            CustomerId: studentId,
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
                    ProductId: parseInt(membership_id),
                    Price: paid_amount,
                    Quantity: 1,
                },
            ],
            AccrualDate: accrualDate,
            AccrualLength: accrualLength,
        });
        
        log('Invoice response: ' + JSON.stringify(invoiceResponse));
        return res.json({ temp: 'temp' });
    }


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


// Utility function to determine accrual date based on current date
function determineAccrualDate(): string {
    const currentDate = new Date();
    let accrualDate: Date;

    if (currentDate.getMonth() < 6) {
        accrualDate = new Date(currentDate.getFullYear(), 6, 1); // July 1st
    } else {
        accrualDate = new Date(currentDate.getFullYear() + 1, 0, 1); // January 1st of the next year
    }

    const yyyy = accrualDate.getFullYear();
    const mm = String(accrualDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
    const dd = String(accrualDate.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
}
