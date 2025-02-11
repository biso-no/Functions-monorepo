import { accountService, attachmentService, FileType, FileLocation, soapClient, UserDefinedDimensionKey } from "@biso/twentyfour";
import { Context } from "@biso/types";
import { createAdminClient } from "@biso/appwrite";
import { Models } from "node-appwrite";
import sharp from 'sharp';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff'
];

// 24SevenOffice Dimension Types
enum DimensionType {
    None = 'None',
    Department = 'Department',
    Employee = 'Employee',
    Project = 'Project',
    Product = 'Product',
    Customer = 'Customer',
    CustomerOrderSlip = 'CustomerOrderSlip',
    SupplierOrderSlip = 'SupplierOrderSlip',
    UserDefined = 'UserDefined'
}

interface KeyValuePair {
    Key: string;
    Value: string;
}

interface UserDefinedDimensions {
    Type: UserDefinedDimensionKey;
    Name: string;
    Value: string;
    TypeId: string;
}

interface Dimension {
    Type: DimensionType;
    Name: string;
    Value: string;
    Percent?: number;
    TypeId?: number;  // For UserDefinedDimensions (TypeId >= 100)
}

// Custom error classes
class FileProcessingError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'FileProcessingError';
    }
}

class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

interface User extends Models.Document {
    phone: string;
    address: string;
    city: string;
    zip: string;
    bank_account: string;
    name: string;
    email: string;
    campus_id: string;
    department_ids: string[];
    student_id: string;
    swift: string;
    isActive: boolean;
}

interface ExpenseAttachment extends Models.Document {
    date: string;
    url: string;
    amount: number;
    description: string;
    type: string;
}

interface Expense extends Models.Document {
    campus: string;
    department: string;
    bank_account: string;
    description: string;
    total: number;
    prepayment_amount: number;
    status: 'pending' | 'approved' | 'rejected';
    invoice_id: number | null;
    userId: string;
    user?: User;  // From relationship
    expenseAttachments?: ExpenseAttachment[];  // From relationship
    stampNo?: number;  // Added for 24SO integration
}

function validateFile(buffer: Buffer, mimeType: string): void {
    if (buffer.length > MAX_FILE_SIZE) {
        throw new ValidationError(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    
    if (mimeType === 'application/pdf') {
        throw new ValidationError(
            'PDF files are not supported by 24SevenOffice. Please convert the PDF to an image format (PNG, JPEG, etc.) before uploading.'
        );
    }
    
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new ValidationError(`Unsupported file type: ${mimeType}. Allowed types are: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }
}

function getFileType(mimeType: string): FileType {
    switch (mimeType) {
        case 'image/jpeg': return FileType.JPEG;
        case 'image/png': return FileType.PNG;
        case 'image/gif': return FileType.GIF;
        case 'image/bmp': return FileType.BMP;
        case 'image/tiff': return FileType.TIFF;
        default: return FileType.PNG;
    }
}

async function convertPdfToImage(pdfBuffer: Buffer, log: (msg: any) => void): Promise<Buffer> {
    const startTime = Date.now();
    log(`Starting PDF conversion. File size: ${pdfBuffer.length / 1024}KB`);

    try {
        // Convert PDF to PNG using sharp
        const image = await sharp(pdfBuffer, { page: 0 })  // Get first page
            .png()
            .resize(2000, null, {  // Resize to 2000px width, maintain aspect ratio
                withoutEnlargement: true,
                fit: 'inside'
            })
            .toBuffer();

        // Log conversion metrics
        const endTime = Date.now();
        log(`PDF conversion completed. Duration: ${endTime - startTime}ms, Output size: ${image.length / 1024}KB`);
        
        return image;
    } catch (err) {
        throw new FileProcessingError('Failed to convert PDF to image', err instanceof Error ? err : undefined);
    }
}

async function processFileForUpload(
    fileBuffer: Buffer,
    mimeType: string,
    log: (msg: any) => void
): Promise<{ buffer: Buffer; fileType: FileType }> {
    if (fileBuffer.length > MAX_FILE_SIZE) {
        throw new ValidationError(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    
    log(`Processing file of type ${mimeType}, size: ${fileBuffer.length / 1024}KB`);
    
    // Handle PDF conversion
    if (mimeType === 'application/pdf') {
        log('Converting PDF to PNG...');
        const convertedBuffer = await convertPdfToImage(fileBuffer, log);
        return {
            buffer: convertedBuffer,
            fileType: FileType.PNG
        };
    }
    
    // Validate other file types
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new ValidationError(`Unsupported file type: ${mimeType}. Allowed types are: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }
    
    return {
        buffer: fileBuffer,
        fileType: getFileType(mimeType)
    };
}

function formatDimensions(dimensions: UserDefinedDimensions[]): KeyValuePair[] {
    return dimensions.map((dim, index) => ({
        Key: `Dimension${index + 1}`,
        Value: `${dim.Type}=${dim.Value}`
    }));
}

export default async ({ req, res, log, error }: Context) => {
    const { uploadAttachment } = attachmentService(error, log);
    const { databases, storage } = await createAdminClient();
    const { getAccessToken, searchCustomer, createCustomer } = soapClient(error, log);

    try {
        const expenseId = req.body.$id;
        if (!expenseId) {
            throw new ValidationError('Expense ID is required');
        }

        // Get expense details from database with relationships expanded
        const expense = await databases.getDocument<Expense>(
            'main',
            'expenses',
            expenseId,
            [
                'user',
                'expenseAttachments'
            ]
        );

        if (!expense.invoice_id) {
            throw new ValidationError('Invoice not yet generated');
        }

        if (!expense.user || !expense.expenseAttachments) {
            throw new ValidationError('Required relationships not loaded');
        }

        // Get authentication token
        const authResult = await getAccessToken();
        if (authResult.status !== 'ok' || !authResult.accessToken) {
            throw new Error('Failed to authenticate with 24SevenOffice');
        }
        const token = authResult.accessToken;

        // First, upload the invoice
        log('Uploading invoice...');

        let customerId = null;
        const existingCustomer = await searchCustomer(token, expense.user.name, expense.user.email);
        if (!existingCustomer) {
            const newCustomer = await createCustomer(token, { name: expense.user.name, email: expense.user.email });
            customerId = newCustomer.Id;
        } else {
            customerId = existingCustomer.Id;
        }

        const invoiceFileId = `invoice_${expense.invoice_id}`;
        const invoiceFile = await storage.getFileDownload('expense_invoices', invoiceFileId);
        const invoiceFileMeta = await storage.getFile('expense_invoices', invoiceFileId);
        
        // Convert if PDF
        const { buffer: invoiceBuffer, fileType: invoiceFileType } = await processFileForUpload(
            Buffer.from(invoiceFile),
            invoiceFileMeta.mimeType,
            log
        );
        
        // Prepare dimensions
        const dimensions: UserDefinedDimensions[] = [
            {
                Type: UserDefinedDimensionKey.Department,
                Name: 'Department',
                Value: expense.department,
                TypeId: '1'  // You might need to adjust this ID based on your 24SO configuration
            },
            {
                Type: UserDefinedDimensionKey.UserDefined,
                Name: 'Campus',
                Value: expense.campus,
                TypeId: '100'  // Using 100 as it's the start of user-defined dimension IDs
            }
        ];

        const dimensionMetadata = formatDimensions(dimensions);
        
        const invoiceStampNo = await uploadAttachment(token, {
            fileType: invoiceFileType,
            fileBuffer: invoiceBuffer,
            customMetadata: [
                { Key: 'InvoiceNo', Value: expense.invoice_id.toString() },
                { Key: 'CustomerNo', Value: customerId },
                { Key: 'InvoiceOCR', Value: expense.invoice_id.toString() },
                { Key: 'Amount', Value: expense.total.toString() },
                { Key: 'Credit', Value: '7610' },
                { Key: 'Debit', Value: '2400' },
                { Key: 'InvoiceDate', Value: expense.created_at },
                { Key: 'BankAccountNo', Value: expense.bank_account },
                ...dimensionMetadata
            ]
        });

        log(`Invoice uploaded with stamp number: ${invoiceStampNo}`);

        // Track failed receipts
        const failedReceipts: Array<{ id: string; error: string }> = [];

        // Then upload all receipts with the same stamp number
        for (let i = 0; i < expense.expenseAttachments.length; i++) {
            const attachment = expense.expenseAttachments[i];
            log(`Uploading receipt ${i + 1}/${expense.expenseAttachments.length}...`);

            try {
                // Get file ID from the URL
                const fileId = attachment.url.split('/').pop() as string;
                const receiptFile = await storage.getFileDownload('expense_attachments', fileId);
                const fileMeta = await storage.getFile('expense_attachments', fileId);

                // Convert if PDF
                const { buffer: receiptBuffer, fileType: receiptFileType } = await processFileForUpload(
                    Buffer.from(receiptFile),
                    fileMeta.mimeType,
                    log
                );

                await uploadAttachment(token, {
                    fileType: receiptFileType,
                    fileBuffer: receiptBuffer,
                    pageNo: i + 1,
                    customMetadata: [
                        { Key: 'Amount', Value: attachment.amount.toString() },
                        { Key: 'Comment', Value: attachment.description },
                        { Key: 'InvoiceDate', Value: attachment.date },
                        { Key: 'Type', Value: attachment.type },
                        ...dimensionMetadata
                    ]
                });

                log(`Receipt ${i + 1} uploaded successfully`);
            } catch (uploadErr) {
                const errorMessage = uploadErr instanceof Error ? uploadErr.message : 'Unknown error';
                error(`Failed to upload receipt ${i + 1}: ${errorMessage}`);
                failedReceipts.push({ 
                    id: attachment.$id,
                    error: errorMessage
                });
                continue;
            }
        }

        // Update expense status in database
        await databases.updateDocument(
            'main',
            'expenses',
            expenseId,
            {
                status: 'approved',
                stampNo: invoiceStampNo
            }
        );

        return res.json({
            success: true,
            stampNo: invoiceStampNo,
            message: `Successfully uploaded invoice and ${expense.expenseAttachments.length - failedReceipts.length} receipts`,
            failedReceipts: failedReceipts.length > 0 ? failedReceipts : undefined
        });

    } catch (err) {
        error('Error processing expense:');
        error(err);
        
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        const statusCode = err instanceof ValidationError ? 400 : 500;
        
        return res.json({
            success: false,
            error: errorMessage
        }, statusCode);
    }
};