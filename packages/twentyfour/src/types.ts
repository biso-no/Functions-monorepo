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

// Account Service Types
export interface BundleList {
    Bundles: Bundle[];
    SaveOption: 0 | 1; // 0 = direct to ledger, 1 = save as journal (default)
    DirectLedger: boolean; // default false
    DefaultCustomerId: number;
    AllowDifference: boolean; // default false
    IgnoreWarnings?: string[]; // ['vatisnotinbalance', 'vatismissingfoundation', 'invoicealreadyexists', 'customermismatchbankaccount']
}

export interface Bundle {
    YearId: number; // e.g., 2024
    Vouchers: Voucher[];
    Sort: number; // Entry type from GetTransactionTypes
    Name: string;
    BundleDirectAccounting: boolean; // false = auto VAT calc, true = no VAT calc
}

export interface Voucher {
    TransactionNo: number;
    Entries: Entry[];
    Sort: number;
    DifferenceOptions?: any; // TODO: Define DifferenceOptions type if needed
}
export enum Campus {
    Bergen = 'Bergen',
    Oslo = 'Oslo',
    Stavanger = 'Stavanger',
    Trondheim = 'Trondheim',
    National = 'National',
  }
  
export interface Department {
    Id: string;
    Name: string;
    Campus: Campus;
  }


export interface Entry {
    SequenceId?: number;
    CustomerId?: number;
    AccountNo: number;
    Date: string;
    DueDate?: string;
    Amount: number; // positive for debit, negative for credit
    CurrencyId?: string; // e.g., 'NOK', 'USD'
    CurrencyRate?: number;
    CurrencyUnit?: number; // default 1
    DepartmentId?: number;
    ProjectId?: number;
    InvoiceReferenceNo?: string;
    InvoiceOcr?: string;
    TaxNo?: number;
    PeriodDate?: string;
    Comment?: string;
    StampNo?: number;
    BankAccountNo?: string;
    LinkId?: string; // GUID
    Links?: string[]; // Array of LinkIds
    LineId?: string; // For linking to existing entries
}

export interface EntryItem {
    LineId: string; // GUID
    DueDate: string;
}

export interface LinkEntryItem {
    LineIds: string[]; // Array of GUIDs
    LinkId: number;
}

export interface AccountData {
    AccountId: number;
    AccountNo: number;
    AccountName: string;
    AccountTax: number;
    TaxNo: number;
}

export enum AccountDataError {
    OK = 'OK',
    AccountDontExist = 'AccountDontExist',
    NameDontMatch = 'NameDontMatch'
}

export interface TypeData {
    TypeId: number;
    TypeNo: number;
    Title: string;
    EntrySeriesID: number;
}

export interface TaxMappingList {
    GroupId: string; // GUID
    Name: string;
    Description: string;
    IsTemplate: boolean;
    ElementList: TaxMappingElement[];
}

export interface TaxMappingElement {
    Symbol: string;
    TaxNo: number;
}

export interface TaxCodeElement {
    TaxId: number;
    TaxNo: string;
    TaxName: string;
    TaxRate: number;
    AccountNo: number;
}

export enum SaveBundleListResultType {
    Ok = 'Ok',
    DuplicateData = 'DuplicateData',
    DataAlreadySaved = 'DataAlreadySaved',
    NotAuthenticated = 'NotAuthenticated',
    SystemError = 'SystemError',
    Exception = 'Exception',
    NotSaved = 'NotSaved'
}

export interface SaveBundleListResult {
    Type: SaveBundleListResultType;
    Description: string;
}

export interface GetEntryIdResult {
    Date: string;
    SortNo: number;
    EntryNo: number;
}

export interface ArgEntryId {
    Date: string;
    SortNo: number;
    EntryNo: number;
}

// Attachment Service Types
/**
 * Key-value pair for metadata
 */
export interface KeyValuePair {
    Key: string;
    Value: string;
}

/**
 * Image file in 24SevenOffice
 */
export interface ImageFile {
    Id: number;                      // Set by response from Create
    Type: FileType;                  // Enum of supported file types
    StampNo?: number;               // Read only, not used when saving
    StampMeta?: KeyValuePair[];     // Read only, not used when saving
    FrameInfo?: ImageFrameInfo[];   
    ContactId?: number[];           // Read only, lists approvers
}

export enum FileType {
    Unknown = 'Unknown',
    WMF = 'WMF',
    PNG = 'PNG',
    TIFF = 'TIFF',
    BMP = 'BMP',
    GIF = 'GIF',
    JPEG = 'JPEG'
}

/**
 * File location in 24SevenOffice.
 * - Retrieval: Image will show up in the inbox in the Retrieval Module
 * - Journal: Image is posted directly as journal data (skips inbox)
 * - Scanning: NOT IMPLEMENTED - DO NOT USE
 */
export enum FileLocation {
    Retrieval = 'Retrieval',
    Scanning = 'Scanning',  // Not implemented and may not be used
    Journal = 'Journal'
}

/**
 * Frame information for an image file.
 */
export interface ImageFrameInfo {
    Id: number;              // Must be set to 1
    Uri?: never;            // Not in use - should never be set
    StampNo: number;        // Current or new stamp number from GetStampNo
    MetaData?: KeyValuePair[];  // Changed from MetaData[] to KeyValuePair[]
    Status: number;         // Not in use - must be set to 0
}

/**
 * Metadata fields for attachment files in 24SevenOffice.
 * Note: These fields are only used when location is set to Retrieval.
 * They populate corresponding fields in the Retrieval Module.
 * Meta data is not automatically populated if you also specify a StampNo.
 */
export interface MetaDataFields {
    Amount?: string;
    Comment?: string;
    Credit?: string;
    CurrencySymbol?: string;
    CustomerName?: string;
    CustomerNo?: string;
    Debit?: string;
    Dimensions?: string;
    DocumentFormat?: string;
    InvoiceBankAccountNo?: string;
    InvoiceDate?: string;
    InvoiceDueDate?: string;
    InvoiceNo?: string;
    InvoiceOCR?: string;
    TransactionTypeNo?: string;
    Type?: string;
    PageNo?: string;
}

export interface FileInfoParameters {
    StampNo?: number[];
    FileId?: number[];
    AttachmentRegisteredAfter?: string;
    AttachmentChangedAfter?: string;
    HasStampNo?: boolean;
    FileApproved?: boolean;
    AttachmentStatus?: FlagType[];
}

export enum FlagType {
    None = 'None',
    Assigned = 'Assigned',
    Approved = 'Approved',
    Declined = 'Declined',
    Archived = 'Archived',
    Distributed = 'Distributed',
    PrepostedInJournal = 'PrepostedInJournal',
    PostedInJournal = 'PostedInJournal'
}

// Attachment Service Response Types
export interface StampSeries {
    Id: string; // guid
    Name: string;
    Start: number;
    End: number;
}

export interface GetSeriesResult {
    StampSeries: StampSeries[];
}

export interface GetFileInfoResult {
    ImageFile: ImageFile[];
}

export interface CreateResult extends ImageFile {}