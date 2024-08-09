import axios from 'axios';
import { parseStringPromise } from 'xml2js';

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
    None,
    Department,
    Employee,
    Project,
    Product,
    Customer,
    CustomerOrderSlip,
    SupplierOrderSlip,
    UserDefined
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
    AccrualDate?: Date; 
    AccrualLength?: number; 
    InvoiceRows?: InvoiceRow[]; 
    UserDefinedDimensions?: UserDefinedDimensions[]; 
}

export const soapClient = () => {

    const getAccessToken = async () => {
        const SOAP_BODY = `
        <?xml version="1.0" encoding="utf-8"?>
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
            return match[1];
        } catch (error) {
            console.error('Error during authentication:', error);
            throw error;
        }
    };

    const createInvoice = async (accessToken: string, data: InvoiceOrder) => {
        const invoiceRowsXML = data.InvoiceRows?.map(row => `
            <InvoiceRow>
              <ProductId>${row.ProductId ?? ''}</ProductId>
              <Price>${row.Price ?? ''}</Price>
              <Quantity>${row.Quantity ?? ''}</Quantity>
            </InvoiceRow>`).join('') || '';

        const userDefinedDimensionsXML = data.UserDefinedDimensions?.map(udd => `
            <UserDefinedDimension>
              <Type>${udd.Type}</Type>
              <Name>${udd.Name}</Name>
              <TypeId>${udd.TypeId}</TypeId>
            </UserDefinedDimension>`).join('') || '';

        const SOAP_BODY = `
        <?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <SaveInvoices xmlns="http://24sevenOffice.com/webservices">
              <invoices>
                <InvoiceOrder>
                  <CustomerId>${data.CustomerId}</CustomerId>
                  <OrderStatus>${data.OrderStatus}</OrderStatus>
                  <DateOrdered>${data.DateOrdered}</DateOrdered>
                  <DateInvoiced>${data.DateInvoiced}</DateInvoiced>
                  <DateChanged>${data.DateChanged}</DateChanged>
                  <PaymentTime>${data.PaymentTime}</PaymentTime>
                  <ProjectId>${data.ProjectId}</ProjectId>
                  <PaymentMethodId>${data.PaymentMethodId}</PaymentMethodId>
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
          </soap:Body>
        </soap:Envelope>`;

        try {
            const response = await axios.post(INVOICE_URL, SOAP_BODY, {
                headers: {
                    'Content-Type': 'application/soap+xml; charset=utf-8',
                    'Authorization': `ASP_NET.SessionId=${accessToken}`
                }
            });

            if (response.status !== 200) {
                throw new Error('Failed to create invoice');
            }

            const responseText = response.data;
            const match = responseText.match(/<InvoiceId>(.*)<\/InvoiceId>/);
            if (!match) {
                throw new Error('Invoice ID not found in response');
            }
            return match[1];
        } catch (error) {
            console.error('Error during invoice creation:', error);
            throw error;
        }
    };

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

  const updateCustomerCategory = async (token: string, customerCategoryId: number, studentId: string) => {
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

    return {
        getAccessToken,
        createInvoice,
        getCustomerCategories,
        updateCustomerCategory
    };
};
