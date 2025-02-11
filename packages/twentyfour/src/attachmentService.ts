import { soapClient } from "./soapClient.js";
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { 
    FileType,
    FileLocation,
    ImageFile,
    FileInfoParameters,
    MetaData,
    ImageFrameInfo,
    KeyValuePair,
    CreateResult,
    GetFileInfoResult,
    GetSeriesResult,
    StampSeries
} from './types.js';

const ATTACHMENT_SERVICE_URL = 'https://webservices.24sevenoffice.com/Economy/Accounting/Accounting_V001/AttachmentService.asmx';

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

export const attachmentService = (error: (msg: any) => void, log: (msg: any) => void) => {
    const { getAccessToken } = soapClient(error, log);

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
            `<StampMeta>${file.StampMeta.map(meta => 
                `<KeyValuePair><Key>${meta.Key}</Key><Value>${meta.Value}</Value></KeyValuePair>`
            ).join('')}</StampMeta>` : '';

        const frameInfoXml = file.FrameInfo ? 
            `<FrameInfo>${file.FrameInfo.map(frame => 
                `<ImageFrameInfo>
                    <Id>${frame.Id}</Id>
                    <Uri>${frame.Uri}</Uri>
                    <StampNo>${frame.StampNo}</StampNo>
                    <MetaData xsi:nil="true" />
                    <Status>${frame.Status}</Status>
                </ImageFrameInfo>`
            ).join('')}</FrameInfo>` : '';

        const contactIdXml = file.ContactId ? 
            `<ContactId>${file.ContactId.map(id => `<int>${id}</int>`).join('')}</ContactId>` : '';

        return `
            <Id>${file.Id}</Id>
            <Type>${file.Type}</Type>
            <StampNo>${file.StampNo}</StampNo>
            ${stampMetaXml}
            ${frameInfoXml}
            ${contactIdXml}
        `;
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