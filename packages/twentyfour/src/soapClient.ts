import { Models } from '@biso/appwrite';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import fetch from 'node-fetch';

const AUTH_URL = 'https://api.24sevenoffice.com/authenticate/v001/authenticate.asmx';
const INVOICE_URL = 'https://api.24sevenoffice.com/Economy/InvoiceOrder/V001/InvoiceService.asmx';

interface InvoiceRow {
    ProductId?: number;
    Price?: number;
    Name?: string;
    Quantity?: number;
    DepartmentId?: number;
    ProjectId?: number;
}

interface UserDefinedDimensions {
    Type: UserDefinedDimensionKey;
    Name: string;
    TypeId: string;
}

export enum UserDefinedDimensionKey {
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

interface InvoiceOrder {
    OrderId?: number; 
    CustomerId: number; 
    CustomerName?: string; 
    CustomerDeliveryName?: string; 
    CustomerDeliveryPhone?: string; 
    DeliveryAlternative?: string; 
    InvoiceId?: number; 
    DateOrdered?: Date; 
    DateInvoiced?: Date; 
    DateChanged?: Date; 
    OrderStatus?: string;
    PaymentTime?: number; 
    CustomerReferenceNo?: string; 
    ProjectId?: number; 
    OurReference?: number; 
    IncludeVAT?: boolean | null; 
    YourReference?: string; 
    InvoiceTitle?: string; 
    InvoiceText?: string; 
    Paid?: Date; 
    CustomerOrgNo?: string; 
    PaymentMethodId?: number; 
    PaymentAmount?: number; 
    DepartmentId?: number; 
    ReferenceInvoiceId?: number; 
    ReferenceOrderId?: number; 
    ReferenceNumber?: string; 
    InvoiceEmailAddress?: string; 
    AccrualDate?: string; 
    AccrualLength?: number; 
    InvoiceRows?: InvoiceRow[]; 
    UserDefinedDimensions?: UserDefinedDimensions[]; 
}

interface Company {
  Id: number;
  Name: string; // Max length 200 characters
  FirstName?: string; // Max length 50 characters, only in use on Company Type ‘Consumer’
  Type: 'None' | 'Lead' | 'Consumer' | 'Business' | 'Supplier'; // Enum
  DistributionMethod?: 'Default' | 'Unchanged' | 'Print' | 'EMail' | 'ElectronicInvoice'; // Enum
  CurrencyId?: string; // Default: LOCAL
  PaymentTime?: number; // Special conditions described in the text
  GLNNumber?: string; // Default value: “”. Max length 13 characters
  Factoring?: boolean;
  LedgerCustomerAccount?: number; // The account number used for the customer ledger
  LedgerSupplierAccount?: number; // The account number used for the supplier ledger
  VatNumber?: string;
  Private?: boolean; // False = "visible to all", true = "visible to owner"
  ExplicitlySpecifyNewCompanyId?: boolean; // Set companyId explicitly
}

const sanitizeXmlString = (xml: string) => {
  return xml.replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '');
};

export const soapClient = () => {

    const getAccessToken = async () => {
        const SOAP_BODY = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
          <soap12:Body>
            <Login xmlns="http://24sevenOffice.com/webservices">
              <credential>
                <ApplicationId>${process.env.TWENTYFOUR_APP_ID}</ApplicationId>
                <Password>${process.env.TWENTYFOUR_PASSWORD}</Password>
                <Username>${process.env.TWENTYFOUR_USERNAME}</Username>
              </credential>
            </Login>
          </soap12:Body>
        </soap12:Envelope>`;

        try {
            const response = await axios.post(AUTH_URL, SOAP_BODY, {
                headers: {
                    'Content-Type': 'application/soap+xml; charset=utf-8'
                }
            });

            if (response.status !== 200) {
                throw new Error('Failed to authenticate with 24sevenoffice');
            }

            const responseText = response.data;
            const match = responseText.match(/<LoginResult>(.*)<\/LoginResult>/);
            if (!match) {
                throw new Error('Access token not found in response');
            }
            return {
                accessToken: match[1],
                status: 'ok'
            }
        } catch (error) {
            console.error('Error during authentication:', error);
            return {
                status: 'error',
                error: error
            }
        }
    };

    const createInvoice = async (accessToken: string, data: InvoiceOrder) => {
      // Manually concatenate the XML string parts without using template literals
      const invoiceRowsXML = data.InvoiceRows?.map(row => 
          `<InvoiceRow>
            <ProductId>${row.ProductId ?? ''}</ProductId>
            <Price>${row.Price ?? ''}</Price>
            <Quantity>${row.Quantity ?? ''}</Quantity>
          </InvoiceRow>`
      ).join('') || '';
    
      const userDefinedDimensionsXML = data.UserDefinedDimensions?.map(udd => 
          `<UserDefinedDimension>
            <Type>${udd.Type}</Type>
            <Name>${udd.Name}</Name>
            <TypeId>${udd.TypeId}</TypeId>
          </UserDefinedDimension>`
      ).join('') || '';
      
    
      const SOAP_BODY = `<?xml version="1.0" encoding="utf-8"?>
      <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                       xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                       xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
        <soap12:Body>
          <SaveInvoices xmlns="http://24sevenOffice.com/webservices">
            <invoices>
              <InvoiceOrder>
                <CustomerId>${data.CustomerId}</CustomerId>
                <OrderStatus>${data.OrderStatus}</OrderStatus>
                <PaymentMethodId>${data.PaymentMethodId}</PaymentMethodId>
                <PaymentTime>${data.PaymentTime}</PaymentTime>
                <PaymentAmount>${data.PaymentAmount}</PaymentAmount>
                <Distributor>Manual</Distributor>
                <DepartmentId>${data.DepartmentId}</DepartmentId>
                <InvoiceRows>${invoiceRowsXML}</InvoiceRows>
                <AccrualDate>${data.AccrualDate}</AccrualDate>
                <AccrualLength>${data.AccrualLength}</AccrualLength>
                <UserDefinedDimensions>${userDefinedDimensionsXML}</UserDefinedDimensions>
              </InvoiceOrder>
            </invoices>
          </SaveInvoices>
        </soap12:Body>
      </soap12:Envelope>`;
    
        // No need to sanitize if SOAP_BODY is constructed properly
        const response = await fetch(INVOICE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'Cookie': `ASP_NET.SessionId=${accessToken}`
            },
            body: SOAP_BODY
        });
    
        return response;
      }
      
  
    const getCustomerCategories = async (token: string) => {
      try {
          const body = `<?xml version="1.0" encoding="utf-8"?>
          <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
              <soap12:Body>
                  <GetCustomerCategoryTree xmlns="http://24sevenOffice.com/webservices" />
              </soap12:Body>
          </soap12:Envelope>`;

          const response = await axios.post('https://api.24sevenoffice.com/CRM/Company/V001/CompanyService.asmx', body, {
              headers: {
                  'Content-Type': 'application/soap+xml; charset=utf-8',
                  'Cookie': 'ASP.NET_SessionId=' + token
              }
          });

          const parsedResponse = await parseStringPromise(response.data, {
              explicitArray: false, // This option prevents arrays from being created for each element
              ignoreAttrs: true // This option ignores the attributes and only parses the values
          });

          // Extract the customer categories from the parsed response
          const categories = parsedResponse['soap:Envelope']['soap:Body']['GetCustomerCategoryTreeResponse']['GetCustomerCategoryTreeResult']['KeyValuePair'];
          return categories;

      } catch (error) {
          console.error('Error during customer category retrieval:', error);
          throw error;
      }
  };

  const updateCustomerCategory = async (token: string, customerCategoryId: number, studentId: number) => {
    
    try {
        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
          <soap12:Body>
            <SaveCustomerCategories xmlns="http://24sevenOffice.com/webservices">
              <customerCategories>
                <KeyValuePair>
                  <Key>${customerCategoryId}</Key>
                  <Value>${studentId}</Value>
                </KeyValuePair>
              </customerCategories>
            </SaveCustomerCategories>
          </soap12:Body>
        </soap12:Envelope>`;

        const response = await axios.post('https://api.24sevenoffice.com/CRM/Company/V001/CompanyService.asmx', body, {
            headers: {
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'Cookie': 'ASP.NET_SessionId=' + token
            }
        });

        const parsedResponse = await parseStringPromise(response.data, {
            explicitArray: false, // This option prevents arrays from being created for each element
            ignoreAttrs: true // This option ignores the attributes and only parses the values
        });

        // Extract the customer categories from the parsed response
        const apiExceptions = parsedResponse['soap:Envelope']['soap:Body']['SaveCustomerCategoriesResponse']['SaveCustomerCategoriesResult'];
        if (apiExceptions) {
            throw new Error(apiExceptions['ApiException']['Message']);
        }

        return true;

    } catch (error) {
        console.error('Error during customer category update:', error);
        throw error;
    }
};
const getCustomer = async (token: string, customerId: number) => {
    //A student ID looks like this: s1715738. remove the s

  try {
    const body = `<?xml version="1.0" encoding="utf-8"?>
    <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
      <soap12:Body>
        <GetCompanies xmlns="http://24sevenOffice.com/webservices">
          <searchParams>
            <CompanyId>${customerId}</CompanyId>
          </searchParams>
          <returnProperties>
            <string>Name</string>
          </returnProperties>
        </GetCompanies>
      </soap12:Body>
    </soap12:Envelope>`;

    const response = await axios.post('https://api.24sevenoffice.com/CRM/Company/V001/CompanyService.asmx', body, {
        headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'Cookie': 'ASP.NET_SessionId=' + token
        }
    });

    const parsedResponse = await parseStringPromise(response.data, {
        explicitArray: false, // Prevent arrays for single elements
        ignoreAttrs: true // Ignore attributes
    });

    // Extract the customer(s) from the parsed response
    const companies = parsedResponse['soap:Envelope']['soap:Body']['GetCompaniesResponse']?.['GetCompaniesResult']?.['Company'];

    // Ensure that there is at least one company in the response
    if (!companies) {
        throw new Error('No companies found in the response');
    }

    // If companies is an array, return the first company, otherwise return the single company object
    return Array.isArray(companies) ? companies[0] : companies;

  } catch (error) {
    console.error('Error during customer retrieval:', error);
    throw error;
  }
};



const createCustomer = async (token: string, user: Models.Document) => {

  const studentId = parseInt(user.student_id.replace('s', ''));
  try {
    const firstName = user.name.split(' ')[0];

    const body = `<?xml version="1.0" encoding="utf-8"?>
    <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
      <soap12:Body>
        <SaveCompanies xmlns="http://24sevenOffice.com/webservices">
          <companies>
            <Company>
              <Id>${studentId}</Id>
              <Name>(Student) ${user.name}</Name>
              <FirstName>${firstName}</FirstName>
              <Type>Consumer</Type>
            </Company>
          </companies>
        </SaveCompanies>
      </soap12:Body>
    </soap12:Envelope>`;

    const response = await axios.post('https://api.24sevenoffice.com/CRM/Company/V001/CompanyService.asmx', body, {
        headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'Cookie': 'ASP.NET_SessionId=' + token
        }
    });

    const parsedResponse = await parseStringPromise(response.data, {
        explicitArray: false, // This option prevents arrays from being created for each element
        ignoreAttrs: true // This option ignores the attributes and only parses the values
    });

    // Extract the array of companies from the parsed response
    const companies = parsedResponse['soap:Envelope']['soap:Body']['SaveCompaniesResponse']?.['SaveCompaniesResult']?.['Company'];

    // Ensure that there is at least one company in the response
    if (!companies) {
        throw new Error('No companies found in the response');
    } 

    // If companies is an array, return the first company, otherwise return the single company object
    return Array.isArray(companies) ? companies[0] : companies;

      } catch (error) {
          console.error('Error during customer creation:', error);
          throw error;
      }
};




    return {
        getAccessToken,
        createInvoice,
        getCustomerCategories,
        updateCustomerCategory,
        getCustomer,
        createCustomer
    };
};
