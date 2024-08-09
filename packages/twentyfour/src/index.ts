//A client for the 24SevenOffice REST API.
//The client should return each endpoint as a function.
//We use no external dependencies
import { Customer, CustomerParams, ListOptions, SalesOrder, InvoiceCustomer } from "./types.js";

const clientId = process.env.TWENTYFOUR_CLIENT_ID!;
const clientSecret = process.env.TWENTYFOUR_CLIENT_SECRET!;
const organizationId = process.env.TWENTYFOUR_ORGANIZATION_ID!;

export const baseUrl = 'https://rest.api.24sevenoffice.com/v1';

const authUrl = 'https://login.24sevenoffice.com/oauth/token';

export const getAccessToken = async () => {
    
    const body = {
        client_id: clientId,
        client_secret: clientSecret,
        login_organization: organizationId,
        grant_type: 'client_credentials',
        audience: 'https://api.24sevenoffice.com'
    }

    const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    return response;
}

//Export a sales order function returning all request methods. As in an example usage: await salesOrder.getAll(), await salesOrder.create(), etc.
export const salesOrder = async () => {

    const list = async ({
        limit,
        date,
        dateFrom,
        dateTo,
        status,
        customerId,
        invoiceNumber,
        createdFrom,
        createdTo,
        modifiedFrom,
        modifiedTo,
    }: ListOptions) => {
        const response = await fetch(baseUrl + '/salesorders', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + await getAccessToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                limit,
                date,
                dateFrom,
                dateTo,
                status,
                customerId,
                invoiceNumber,
                createdFrom,
                createdTo,
                modifiedFrom,
                modifiedTo,
            })
        });
        return response;
    }

    const get = async (id: number) => {
        const response = await fetch(baseUrl + '/salesorders/' + id, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + await getAccessToken(),
                'Content-Type': 'application/json'
            }
        });
        return response;
    }

    const create = async (salesOrder: SalesOrder) => {
        const response = await fetch(baseUrl + '/salesorders', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + await getAccessToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(salesOrder)
        });
        return response;
    }

    const update = async (salesOrder: SalesOrder) => {
        const response = await fetch(baseUrl + '/salesorders', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + await getAccessToken(),
                'Content-Type': 'application/json'
                    },
            body: JSON.stringify(salesOrder)
                });
        return response;
    }


    return {
        list,
        create,
        update,
        get
    }
}

export const customer = async () => {
    
    const list = async ({
        limit,
        isCompany,
        isSupplier,
        modifiedFrom,
        createdFrom,
        sortBy
    }: CustomerParams) => {
        const response = await fetch(baseUrl + '/customers', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + await getAccessToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                limit,
                isCompany,
                isSupplier,
                modifiedFrom,
                createdFrom,
                sortBy
            })
        });
        return response;
    }

    const get = async (id: number) => {
        const response = await fetch(baseUrl + '/customers/' + id, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + await getAccessToken(),
                'Content-Type': 'application/json'
            }
        });
        return response;
    }

    const create = async (customer: Customer) => {
        
        if (customer.isCompany || customer.isSupplier) {
            const response = await fetch(baseUrl + '/customers', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + await getAccessToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address,
                    isCompany: customer.isCompany,
                    isSupplier: customer.isSupplier,
                    organizationNumber: customer.organizationNumber
                })
            });
            return response;
        } else {
            const response = await fetch(baseUrl + '/customers', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + await getAccessToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address
                })
            });
            return response;
        }
    }

    const update = async (customer: Customer) => {
        const response = await fetch(baseUrl + '/customers', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + await getAccessToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customer)
        });
        return response;
    }

    return {
        list,
        get,
        create,
        update
    }
}