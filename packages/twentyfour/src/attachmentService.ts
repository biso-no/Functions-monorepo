import { soapClient } from "./soapClient.js";
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { 
    FileType,
    FileLocation,
    FlagType,
    ImageFile,
    FileInfoParameters,
    MetaDataFields,
    ImageFrameInfo,
    KeyValuePair,
    CreateResult,
    GetFileInfoResult,
    GetSeriesResult,
    StampSeries
} from './types.js';

const ATTACHMENT_SERVICE_URL = 'https://webservices.24sevenoffice.com/Economy/Accounting/Accounting_V001/AttachmentService.asmx';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

interface UploadAttachmentOptions {
    fileType: FileType;
    fileBuffer: Buffer;
    invoiceOcr?: string;
    pageNo?: number;
    customMetadata?: KeyValuePair[];
}

export const attachmentService = (error: (msg: any) => void, log: (msg: any) => void) => {
    const { getAccessToken } = soapClient(error, log);

    /**
     * Converts MetaDataFields to KeyValuePair array
     */
    function convertMetaDataToKeyValuePairs(metadata: MetaDataFields): KeyValuePair[] {
        return Object.entries(metadata)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => ({
                Key: key,
                Value: value.toString()
            }));
    }

    /**
     * Uploads an attachment following the complete flow:
     * 1. Creates a ghost file
     * 2. Uploads the file in chunks
     * 3. Gets a stamp number
     * 4. Saves the file with metadata
     */
    async function uploadAttachment(token: string, options: UploadAttachmentOptions): Promise<number> {
        try {
            // Step 1: Create ghost file
            log('Creating ghost file...');
            const createResult = await create(token, options.fileType);
            const fileId = createResult.Id;

            // Step 2: Upload file in chunks
            log('Uploading file chunks...');
            const totalChunks = Math.ceil(options.fileBuffer.length / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, options.fileBuffer.length);
                const chunk = options.fileBuffer.slice(start, end);
                const base64Chunk = chunk.toString('base64');

                await appendChunk(token, {
                    Id: fileId,
                    Type: options.fileType
                }, base64Chunk, start);

                log(`Uploaded chunk ${i + 1}/${totalChunks}`);
            }

            // Step 3: Get stamp number
            log('Getting stamp number...');
            const stampNo = await getStampNo(token);

            // Step 4: Save file with metadata
            log('Saving file with metadata...');
            const metadata: KeyValuePair[] = [
                ...(options.pageNo ? [{
                    Key: 'PageNo',
                    Value: options.pageNo.toString()
                }] : []),
                ...(options.invoiceOcr ? [{
                    Key: 'InvoiceOCR',
                    Value: options.invoiceOcr
                }] : []),
                ...(options.customMetadata || [])
            ];

            const file: ImageFile = {
                Id: fileId,
                Type: options.fileType,
                FrameInfo: [{
                    Id: 1,
                    StampNo: stampNo,
                    Status: 0,
                    MetaData: metadata
                }]
            };

            await save(token, file, FileLocation.Retrieval);
            log('File upload completed successfully');
            
            return stampNo;
        } catch (err) {
            error('Error uploading attachment:');
            error(err);
            throw err;
        }
    }

    async function appendChunk(token: string, file: ImageFile, buffer: string, offset: number): Promise<void> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <AppendChunk xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <file>${generateFileInfoXml(file)}</file>
                    <buffer>${buffer}</buffer>
                    <offset>${offset}</offset>
                </AppendChunk>
            </soap12:Body>
        </soap12:Envelope>`;

        await makeRequest(token, body);
    }

    async function appendChunkByLength(token: string, file: ImageFile, buffer: string, bufferLength: number, offset: number): Promise<void> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <AppendChunkByLength xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <file>${generateFileInfoXml(file)}</file>
                    <buffer>${buffer}</buffer>
                    <bufferLength>${bufferLength}</bufferLength>
                    <offset>${offset}</offset>
                </AppendChunkByLength>
            </soap12:Body>
        </soap12:Envelope>`;

        await makeRequest(token, body);
    }

    async function create(token: string, type: FileType): Promise<CreateResult> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <Create xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <type>${type}</type>
                </Create>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].CreateResponse.CreateResult;
    }

    async function downloadChunk(token: string, file: ImageFile, offset: number, bufferSize: number): Promise<string> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <DownloadChunk xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <file>${generateFileInfoXml(file)}</file>
                    <offset>${offset}</offset>
                    <bufferSize>${bufferSize}</bufferSize>
                </DownloadChunk>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].DownloadChunkResponse.DownloadChunkResult;
    }

    async function getChecksum(token: string, file: ImageFile): Promise<string> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetChecksum xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <file>${generateFileInfoXml(file)}</file>
                </GetChecksum>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetChecksumResponse.GetChecksumResult;
    }

    async function getFileInfo(token: string, parameters: FileInfoParameters): Promise<GetFileInfoResult> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetFileInfo xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <parameters>${generateFileInfoParametersXml(parameters)}</parameters>
                </GetFileInfo>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetFileInfoResponse.GetFileInfoResult;
    }

    async function getMaxRequestLength(token: string): Promise<number> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetMaxRequestLength xmlns="http://24sevenoffice.com/webservices/economy/accounting/" />
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetMaxRequestLengthResponse.GetMaxRequestLengthResult;
    }

    async function getSize(token: string, file: ImageFile): Promise<number> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetSize xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <file>${generateFileInfoXml(file)}</file>
                </GetSize>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetSizeResponse.GetSizeResult;
    }

    async function save(token: string, file: ImageFile, location: FileLocation): Promise<void> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <Save xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <file>${generateFileInfoXml(file)}</file>
                    <location>${location}</location>
                </Save>
            </soap12:Body>
        </soap12:Envelope>`;

        await makeRequest(token, body);
    }

    async function getStampNo(token: string): Promise<number> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetStampNo xmlns="http://24sevenoffice.com/webservices/economy/accounting/" />
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetStampNoResponse.GetStampNoResult;
    }

    async function getApproverList(token: string): Promise<KeyValuePair[]> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetApproverList xmlns="http://24sevenoffice.com/webservices/economy/accounting/" />
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetApproverListResponse.GetApproverListResult.KeyValuePair;
    }

    async function getSeries(token: string): Promise<GetSeriesResult> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetSeries xmlns="http://24sevenoffice.com/webservices/economy/accounting/" />
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetSeriesResponse.GetSeriesResult;
    }

    async function getSeriesStampNo(token: string, seriesId: string): Promise<number> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetSeriesStampNo xmlns="http://24sevenoffice.com/webservices/economy/accounting/">
                    <SeriesId>${seriesId}</SeriesId>
                </GetSeriesStampNo>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetSeriesStampNoResponse.GetSeriesStampNoResult;
    }

    // Helper functions
    function generateFileInfoXml(file: ImageFile): string {
        const stampMetaXml = file.StampMeta ? 
            `<StampMeta>${generateKeyValuePairXml(file.StampMeta)}</StampMeta>` : '';

        const frameInfoXml = file.FrameInfo ? 
            `<FrameInfo>${file.FrameInfo.map(frame => {
                const metaDataXml = frame.MetaData?.length 
                    ? `<MetaData>${frame.MetaData.map(meta => 
                        Object.entries(meta)
                            .filter(([_, value]) => value !== undefined)
                            .map(([key, value]) => `<${key}>${value}</${key}>`)
                            .join('')
                    ).join('')}</MetaData>`
                    : '<MetaData xsi:nil="true" />';

                return `<ImageFrameInfo>
                    <Id>1</Id>
                    <StampNo>${frame.StampNo}</StampNo>
                    ${metaDataXml}
                    <Status>0</Status>
                </ImageFrameInfo>`;
            }).join('')}</FrameInfo>` : '';

        const contactIdXml = file.ContactId ? 
            `<ContactId>${file.ContactId.map(id => `<int>${id}</int>`).join('')}</ContactId>` : '';

        return `
            <Id>${file.Id}</Id>
            <Type>${file.Type}</Type>
            ${file.StampNo ? `<StampNo>${file.StampNo}</StampNo>` : ''}
            ${stampMetaXml}
            ${frameInfoXml}
            ${contactIdXml}
        `;
    }

    function generateKeyValuePairXml(pairs: KeyValuePair[]): string {
        return pairs.map(pair => 
            `<KeyValuePair><Key>${pair.Key}</Key><Value>${pair.Value}</Value></KeyValuePair>`
        ).join('');
    }

    function generateFileInfoParametersXml(parameters: FileInfoParameters): string {
        const stampNoXml = parameters.StampNo ? 
            `<StampNo>${parameters.StampNo.map(no => `<int>${no}</int>`).join('')}</StampNo>` : '';
        
        const fileIdXml = parameters.FileId ? 
            `<FileId>${parameters.FileId.map(id => `<int>${id}</int>`).join('')}</FileId>` : '';

        const attachmentStatusXml = parameters.AttachmentStatus ? 
            `<AttachmentStatus>${parameters.AttachmentStatus.map(status => 
                `<FlagType>${status}</FlagType>`
            ).join('')}</AttachmentStatus>` : '';

        return `
            ${stampNoXml}
            ${fileIdXml}
            ${parameters.AttachmentRegisteredAfter ? `<AttachmentRegisteredAfter>${parameters.AttachmentRegisteredAfter}</AttachmentRegisteredAfter>` : ''}
            ${parameters.AttachmentChangedAfter ? `<AttachmentChangedAfter>${parameters.AttachmentChangedAfter}</AttachmentChangedAfter>` : ''}
            ${parameters.HasStampNo !== undefined ? `<HasStampNo>${parameters.HasStampNo}</HasStampNo>` : ''}
            ${parameters.FileApproved !== undefined ? `<FileApproved>${parameters.FileApproved}</FileApproved>` : ''}
            ${attachmentStatusXml}
        `;
    }

    async function makeRequest(token: string, body: string) {
        try {
            const response = await axios.post(ATTACHMENT_SERVICE_URL, body, {
                headers: {
                    'Content-Type': 'application/soap+xml; charset=utf-8',
                    'Cookie': 'ASP.NET_SessionId=' + token
                }
            });

            const parsedResponse = await parseStringPromise(response.data, {
                explicitArray: false,
                ignoreAttrs: true
            });

            return parsedResponse;
        } catch (err) {
            error(err);
            throw err;
        }
    }

    return {
        uploadAttachment,
        appendChunk,
        appendChunkByLength,
        create,
        downloadChunk,
        getChecksum,
        getFileInfo,
        getMaxRequestLength,
        getSize,
        save,
        getStampNo,
        getApproverList,
        getSeries,
        getSeriesStampNo
    };
}; 