export interface InvoiceCustomer {
    id: number;
    organizationNumber?: string;
    gln?: string;
    name: string;
    street?: string;
    postalCode?: string;
    postalArea?: string;
    city?: string;
    countrySubdivision?: string;
    countryCode?: string;
}

export interface Invoice {
    number?: number;
    date?: string;
    dueDate?: string;
    remittanceReference?: string;
}

export enum Status {
    DRAFT = 'Draft',
    PROPOSAL = 'Proposal',
    CONFIRMED = 'Confirmed',
    INVOICE = 'Invoice',
    ADVANCEINVOICE = 'AdvanceInvoice',
}

export interface SalesOrder {
    customer: InvoiceCustomer;
    status: Status;
    delieveryCustomer?: InvoiceCustomer;
    invoice?: Invoice;
    date: string;
    internalMemo?: string;
    memo?: string;
    salesType?: {
        id: number;
    };
    createdAt?: string;
    modifiedAt?: string;
}

export interface ListOptions {
    limit: number;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: Status;
    customerId?: number;
    invoiceNumber?: number;
    createdFrom?: string;
    createdTo?: string;
    modifiedFrom?: string;
    modifiedTo?: string;
}

export interface CustomerParams {
    limit?: number;
    isCompany?: boolean;
    isSupplier?: boolean;
    modifiedFrom?: string;
    createdFrom?: string;
    sortBy?: string;
}

export interface Customer {
    Id: number;
    Name: string;
}