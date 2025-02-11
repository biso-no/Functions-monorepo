import { soapClient } from "./soapClient.js";
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import {
    BundleList,
    AccountData,
    EntryItem,
    LinkEntryItem,
    SaveBundleListResult,
    GetEntryIdResult,
    ArgEntryId,
    TypeData,
    TaxCodeElement,
    TaxMappingList,
    AccountDataError
} from './types.js';

const ACCOUNT_SERVICE_URL = 'https://api.24sevenoffice.com/Economy/Account/V004/Accountservice.asmx';

export const accountService = (error: (msg: any) => void, log: (msg: any) => void) => {
    const { getAccessToken } = soapClient(error, log);

    async function saveBundleList(token: string, bundleList: BundleList): Promise<SaveBundleListResult> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <SaveBundleList xmlns="http://24sevenOffice.com/webservices">
                    <BundleList>
                        ${generateBundleListXml(bundleList)}
                    </BundleList>
                </SaveBundleList>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].SaveBundleListResponse.SaveBundleListResult;
    }

    async function addLinkEntries(token: string, linkEntryItem: LinkEntryItem): Promise<boolean> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <AddLinkEntries xmlns="http://24sevenOffice.com/webservices">
                    <linkEntryItem>
                        <LineIds>${linkEntryItem.LineIds.map(id => `<guid>${id}</guid>`).join('')}</LineIds>
                        <LinkId>${linkEntryItem.LinkId}</LinkId>
                    </linkEntryItem>
                </AddLinkEntries>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].AddLinkEntriesResponse.AddLinkEntriesResult === 'true';
    }

    async function checkAccountNo(token: string, accountList: AccountData[]): Promise<AccountDataError[]> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <CheckAccountNo xmlns="http://24sevenOffice.com/webservices">
                    <accountList>
                        ${accountList.map(account => generateAccountDataXml(account)).join('')}
                    </accountList>
                </CheckAccountNo>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        const result = response['soap:Envelope']['soap:Body'].CheckAccountNoResponse.CheckAccountNoResult;
        return result.AccountDataErrors.map((error: any) => error.Error);
    }

    async function createLink(token: string): Promise<number> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <CreateLink xmlns="http://24sevenOffice.com/webservices" />
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return parseInt(response['soap:Envelope']['soap:Body'].CreateLinkResponse.CreateLinkResult);
    }

    async function getAccountList(token: string): Promise<AccountData[]> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetAccountList xmlns="http://24sevenOffice.com/webservices" />
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        const result = response['soap:Envelope']['soap:Body'].GetAccountListResponse.GetAccountListResult;
        return Array.isArray(result.AccountData) ? result.AccountData : [result.AccountData];
    }

    async function getEntryId(token: string, entryId: ArgEntryId): Promise<GetEntryIdResult> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetEntryId xmlns="http://24sevenOffice.com/webservices">
                    <argEntryId>
                        <Date>${entryId.Date}</Date>
                        <SortNo>${entryId.SortNo}</SortNo>
                        <EntryNo>${entryId.EntryNo}</EntryNo>
                    </argEntryId>
                </GetEntryId>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].GetEntryIdResponse.GetEntryIdResult;
    }

    async function getTaxCodeList(token: string): Promise<TaxCodeElement[]> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetTaxCodeList xmlns="http://24sevenOffice.com/webservices" />
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        const result = response['soap:Envelope']['soap:Body'].GetTaxCodeListResponse.GetTaxCodeListResult;
        return Array.isArray(result.TaxCodeElement) ? result.TaxCodeElement : [result.TaxCodeElement];
    }

    async function getTypeList(token: string): Promise<TypeData[]> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <GetTypeList xmlns="http://24sevenOffice.com/webservices" />
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        const result = response['soap:Envelope']['soap:Body'].GetTypeListResponse.GetTypeListResult;
        return Array.isArray(result.TypeData) ? result.TypeData : [result.TypeData];
    }

    async function replaceLinkEntries(token: string, linkEntryItem: LinkEntryItem): Promise<boolean> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <ReplaceLinkEntries xmlns="http://24sevenOffice.com/webservices">
                    <linkEntryItem>
                        <LineIds>${linkEntryItem.LineIds.map(id => `<guid>${id}</guid>`).join('')}</LineIds>
                        <LinkId>${linkEntryItem.LinkId}</LinkId>
                    </linkEntryItem>
                </ReplaceLinkEntries>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        return response['soap:Envelope']['soap:Body'].ReplaceLinkEntriesResponse.ReplaceLinkEntriesResult === 'true';
    }

    async function updateEntryDueDate(token: string, entryItems: EntryItem[]): Promise<EntryItem[]> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <UpdateEntryDueDate xmlns="http://24sevenOffice.com/webservices">
                    <entryItems>
                        ${entryItems.map(item => `
                            <EntryItem>
                                <LineId>${item.LineId}</LineId>
                                <DueDate>${item.DueDate}</DueDate>
                            </EntryItem>
                        `).join('')}
                    </entryItems>
                </UpdateEntryDueDate>
            </soap12:Body>
        </soap12:Envelope>`;

        const response = await makeRequest(token, body);
        const result = response['soap:Envelope']['soap:Body'].UpdateEntryDueDateResponse.UpdateEntryDueDateResult;
        return Array.isArray(result.EntryItem) ? result.EntryItem : [result.EntryItem];
    }

    // Helper functions
    function generateBundleListXml(bundleList: BundleList): string {
        const bundlesXml = bundleList.Bundles.map(bundle => `
            <Bundle>
                <YearId>${bundle.YearId}</YearId>
                <Vouchers>${generateVouchersXml(bundle.Vouchers)}</Vouchers>
                <Sort>${bundle.Sort}</Sort>
                <Name>${bundle.Name}</Name>
                <BundleDirectAccounting>${bundle.BundleDirectAccounting}</BundleDirectAccounting>
            </Bundle>
        `).join('');

        const ignoreWarningsXml = bundleList.IgnoreWarnings ? 
            `<IgnoreWarnings>${bundleList.IgnoreWarnings.map(warning => `<string>${warning}</string>`).join('')}</IgnoreWarnings>` : '';

        return `
            <Bundles>${bundlesXml}</Bundles>
            <SaveOption>${bundleList.SaveOption}</SaveOption>
            <DirectLedger>${bundleList.DirectLedger}</DirectLedger>
            <DefaultCustomerId>${bundleList.DefaultCustomerId}</DefaultCustomerId>
            <AllowDifference>${bundleList.AllowDifference}</AllowDifference>
            ${ignoreWarningsXml}
        `;
    }

    function generateVouchersXml(vouchers: any[]): string {
        return vouchers.map(voucher => `
            <Voucher>
                <TransactionNo>${voucher.TransactionNo}</TransactionNo>
                <Entries>${generateEntriesXml(voucher.Entries)}</Entries>
                <Sort>${voucher.Sort}</Sort>
                ${voucher.DifferenceOptions ? `<DifferenceOptions>${voucher.DifferenceOptions}</DifferenceOptions>` : ''}
            </Voucher>
        `).join('');
    }

    function generateEntriesXml(entries: any[]): string {
        return entries.map(entry => `
            <Entry>
                ${entry.SequenceId ? `<SequenceId>${entry.SequenceId}</SequenceId>` : ''}
                ${entry.CustomerId ? `<CustomerId>${entry.CustomerId}</CustomerId>` : ''}
                <AccountNo>${entry.AccountNo}</AccountNo>
                <Date>${entry.Date}</Date>
                ${entry.DueDate ? `<DueDate>${entry.DueDate}</DueDate>` : ''}
                <Amount>${entry.Amount}</Amount>
                ${entry.CurrencyId ? `<CurrencyId>${entry.CurrencyId}</CurrencyId>` : ''}
                ${entry.CurrencyRate ? `<CurrencyRate>${entry.CurrencyRate}</CurrencyRate>` : ''}
                ${entry.CurrencyUnit ? `<CurrencyUnit>${entry.CurrencyUnit}</CurrencyUnit>` : ''}
                ${entry.DepartmentId ? `<DepartmentId>${entry.DepartmentId}</DepartmentId>` : ''}
                ${entry.ProjectId ? `<ProjectId>${entry.ProjectId}</ProjectId>` : ''}
                ${entry.InvoiceReferenceNo ? `<InvoiceReferenceNo>${entry.InvoiceReferenceNo}</InvoiceReferenceNo>` : ''}
                ${entry.InvoiceOcr ? `<InvoiceOcr>${entry.InvoiceOcr}</InvoiceOcr>` : ''}
                ${entry.TaxNo ? `<TaxNo>${entry.TaxNo}</TaxNo>` : ''}
                ${entry.PeriodDate ? `<PeriodDate>${entry.PeriodDate}</PeriodDate>` : ''}
                ${entry.Comment ? `<Comment>${entry.Comment}</Comment>` : ''}
                ${entry.StampNo ? `<StampNo>${entry.StampNo}</StampNo>` : ''}
                ${entry.BankAccountNo ? `<BankAccountNo>${entry.BankAccountNo}</BankAccountNo>` : ''}
                ${entry.LinkId ? `<LinkId>${entry.LinkId}</LinkId>` : ''}
                ${entry.Links ? `<Links>${entry.Links.map((link: string) => `<string>${link}</string>`).join('')}</Links>` : ''}
                ${entry.LineId ? `<LineId>${entry.LineId}</LineId>` : ''}
            </Entry>
        `).join('');
    }

    function generateAccountDataXml(account: AccountData): string {
        return `
            <AccountData>
                <AccountId>${account.AccountId}</AccountId>
                <AccountNo>${account.AccountNo}</AccountNo>
                <AccountName>${account.AccountName}</AccountName>
                <AccountTax>${account.AccountTax}</AccountTax>
                <TaxNo>${account.TaxNo}</TaxNo>
            </AccountData>
        `;
    }

    async function makeRequest(token: string, body: string) {
        try {
            const response = await axios.post(ACCOUNT_SERVICE_URL, body, {
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
        saveBundleList,
        addLinkEntries,
        checkAccountNo,
        createLink,
        getAccountList,
        getEntryId,
        getTaxCodeList,
        getTypeList,
        replaceLinkEntries,
        updateEntryDueDate
    };
};