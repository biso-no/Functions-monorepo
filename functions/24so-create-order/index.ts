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
    try {
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

        const { create, get, update } = await customer();
        let existingCustomer: Customer | null = null;

        const response = await get(user.student_id);
        if (response.ok) {
            existingCustomer = await response.json() as Customer;
            log(`Existing customer found for user_id: ${user_id} - ${JSON.stringify(existingCustomer)}`);
        } else {
            log(`Customer not found for user_id: ${user_id}, creating new customer...`);
            const customerResponse = await create({
                id: user.student_id,
                name: user.name,
                email: {
                    contact: user.email,
                    billing: user.email,
                },
                isCompany: false,
                isSupplier: false,
            });

            if (!customerResponse.ok) {
                log('Failed to create customer');
                return res.json({ error: 'Failed to create customer' });
            }

            existingCustomer = await customerResponse.json() as Customer;
            log(`New customer created with ID: ${existingCustomer.id} for user_id: ${user_id}`);
        }

        const { createInvoice, getAccessToken, updateCustomerCategory } = soapClient();
        const tokenResponse = await getAccessToken();

        if (!tokenResponse.ok) {
            log('Failed to retrieve access token');
            return res.json({ error: 'Failed to retrieve access token' });
        }

        const token = await tokenResponse.json();

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

        const customerCategoryId = await updateCustomerCategory(token, membershipObj.category, user.student_id);

        const invoiceStatus = SHOULD_INVOICE === 'true' ? 'Invoiced' : 'Draft';

        const invoiceResponse = await createInvoice(token, {
            CustomerId: existingCustomer.id,
            OrderStatus: invoiceStatus,
            DepartmentId: departmentId,
            IncludeVAT: true,
            PaymentMethodId: 1,
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
                    ProductId: parseInt($id),
                    Price: paid_amount,
                    Quantity: 1,
                },
            ],
            AccrualDate: accrualDate,
            AccrualLength: accrualLength,
        });

        if (!invoiceResponse.ok) {
            log('Failed to create invoice');
            return res.json({ error: 'Failed to create invoice' });
        }

        const invoice = await invoiceResponse.json() as { id: string };
        log(`Invoice created successfully with ID: ${invoice.id} for user_id: ${user_id}`);
        return res.json({ invoiceId: invoice.id });

    } catch (err) {
        const errorMessage = (err as Error).message;
        log(`An error occurred: ${errorMessage}`);
        return res.json({ error: errorMessage });
    }
};


// Utility function to determine department ID based on campus ID
function determineDepartmentId(campusId: string): number {
    switch (campusId) {
        case '1':
            return 100;
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
function determineAccrualDate(): Date {
    const currentDate = new Date();
    if (currentDate.getMonth() < 6) {
        return new Date(currentDate.getFullYear(), 6, 1); // July 1st
    } else {
        return new Date(currentDate.getFullYear() + 1, 0, 1); // January 1st of the next year
    }
}
