# 24SevenOffice Integration Package

This package provides utilities for integrating with 24SevenOffice ERP system, handling orders, products, and customer data for BISO applications.

## 📦 Installation

```bash
bun install
# or
yarn install
```

## 🔧 Configuration

The package requires the following environment variables:

```env
TWENTYFOUR_API_KEY=your_api_key
TWENTYFOUR_CLIENT_ID=your_client_id
TWENTYFOUR_USERNAME=your_username
TWENTYFOUR_PASSWORD=your_password
```

## 🚀 Usage

```typescript
import { createOrder, getProduct } from '@biso/twentyfour';

// Example: Create a new order
const order = await createOrder({
  customerId: 'customer_id',
  items: [
    {
      productId: 'product_id',
      quantity: 1
    }
  ]
});

// Example: Get product details
const product = await getProduct('product_id');
```

## 📚 Available Functions

### Order Management
- `createOrder()`: Create a new order in 24SevenOffice
- `getOrder()`: Retrieve order details
- `updateOrder()`: Update an existing order
- `cancelOrder()`: Cancel an order

### Product Management
- `getProduct()`: Get product details
- `listProducts()`: List all products
- `updateProduct()`: Update product information
- `searchProducts()`: Search for products

### Customer Management
- `createCustomer()`: Create a new customer
- `getCustomer()`: Get customer details
- `updateCustomer()`: Update customer information
- `searchCustomers()`: Search for customers

### Invoice Operations
- `createInvoice()`: Create a new invoice
- `getInvoice()`: Get invoice details
- `listInvoices()`: List invoices

## 🔐 Security

- Store API credentials securely
- Never commit credentials or sensitive information
- Use environment variables for all sensitive configuration
- Follow BISO's security protocols

## ⚠️ Important Notes

- API calls are rate-limited
- Some operations require specific user permissions in 24SevenOffice
- Keep track of API usage for billing purposes
- Implement proper error handling for API responses

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request with a clear description of changes

## 📞 Support

For support, please contact:

**Markus Heien**  
IT Manager, BI Student Organization  
Email: [markus@biso.no](mailto:markus@biso.no)  
Phone: +47 98471622

---

*Part of the BISO Functions Monorepo*
