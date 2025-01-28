# Functions Monorepo

This monorepo contains a collection of serverless functions and utility packages for various services and integrations. The project is structured to handle different aspects of business operations including payment processing, social media integration, user management, and more.

## 🚀 Project Structure

```
functions-monorepo/
├── packages/           # Shared packages and utilities
│   ├── appwrite/      # Appwrite integration utilities
│   ├── instagram/     # Instagram API integration
│   ├── twentyfour/    # 24SevenOffice integration
│   ├── utils/         # Common utility functions
│   └── vipps/         # Vipps payment integration
│
└── functions/         # Serverless functions
    ├── 24so-create-order/
    ├── create-chat-group/
    ├── create-event/
    ├── create-membership-from-shop/
    ├── create-post/
    ├── create-user-doc/
    ├── election-vote/
    ├── extract-pdf/
    ├── get-instagram-posts-by-hashtag/
    ├── verify-biso-membership/
    ├── vipps-callback/
    ├── vipps-payment/
    └── webshop-product/
```

## 🛠️ Technology Stack

- **Runtime**: Node.js with TypeScript
- **Package Manager**: Bun/Yarn (Workspace enabled)
- **Key Dependencies**:
  - `axios`: HTTP client for API requests
  - `instagram-graph-api`: Instagram API integration
  - `xml2js`: XML parsing and processing
  - `node-fetch`: Fetch API implementation

## 📦 Packages

### Core Packages
- **appwrite**: Utilities for Appwrite backend integration
- **instagram**: Instagram API integration helpers
- **twentyfour**: 24SevenOffice integration utilities
- **utils**: Shared utility functions
- **vipps**: Vipps payment integration helpers

## ⚡ Functions

### Payment & Orders
- `24so-create-order`: Create orders in 24SevenOffice
- `vipps-payment`: Handle Vipps payment initiation
- `vipps-callback`: Process Vipps payment callbacks
- `webshop-product`: Manage webshop product operations

### User Management
- `create-user-doc`: User document creation
- `create-membership-from-shop`: Process membership purchases
- `verify-biso-membership`: Membership verification
- `election-vote`: Handle election voting process

### Content & Social
- `create-post`: Content post creation
- `create-event`: Event creation and management
- `get-instagram-posts-by-hashtag`: Instagram hashtag feed integration
- `create-chat-group`: Chat group creation

### Utilities
- `extract-pdf`: PDF data extraction functionality

## 🚦 Getting Started

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   yarn install
   ```

3. **Clean installation (if needed)**
   ```bash
   yarn clean
   ```

## 🔧 Development

### Prerequisites
- Node.js (Latest LTS version recommended)
- Bun or Yarn package manager
- Required API keys and credentials for various services

### Environment Setup
Each function and package may require specific environment variables. Please refer to the individual function/package documentation for detailed requirements.

## 📚 Documentation

Each package and function contains its own README with specific documentation. Common patterns and utilities are documented in the respective package directories.

### Key Integration Points
- Appwrite Backend
- Instagram Graph API
- Vipps Payment Services
- 24SevenOffice
- PDF Processing

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request with a clear description of the changes

## 📝 License

This codebase is proprietary and intended for internal use only within BI Student Organization. Unauthorized distribution or modification of this code outside the company is prohibited.

For more information, please contact the IT department.

## 🔐 Security

- All API keys and sensitive credentials should be stored in environment variables
- Never commit sensitive information to the repository
- Follow security best practices when handling user data and payments

## 📞 Support
For support, please contact:

**Markus Heien**  
IT Manager, BI Student Organization  
Email: [markus@biso.no](mailto:markus@biso.no)  
Phone: +47 98471622


---

*Last updated: January 28th 2025*
