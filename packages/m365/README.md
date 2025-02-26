# Instagram Integration Package

This package provides utilities for interacting with the Instagram Graph API, allowing BISO applications to fetch posts, manage content, and interact with Instagram's platform.

## 📦 Installation

```bash
bun install
# or
yarn install
```

## 🔧 Configuration

The package requires the following environment variables:

```env
INSTAGRAM_ACCESS_TOKEN=your_access_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_business_account_id
```

## 🚀 Usage

```typescript
import { getPostsByHashtag, getMediaDetails } from '@biso/instagram';

// Example: Fetch posts by hashtag
const posts = await getPostsByHashtag('biso', { limit: 10 });

// Example: Get media details
const mediaDetails = await getMediaDetails('media_id');
```

## 📚 Available Functions

### Post Management
- `getPostsByHashtag()`: Fetch posts by hashtag
- `getMediaDetails()`: Get detailed information about a media item
- `getRecentMedia()`: Fetch recent media from a business account

### Account Information
- `getAccountInfo()`: Get information about the connected Instagram account
- `getAccountInsights()`: Fetch account insights and metrics

### Media Interactions
- `getMediaComments()`: Fetch comments on a media item
- `getMediaInsights()`: Get insights for a specific media item

## 🔐 Security

- Store Instagram access tokens securely
- Never commit tokens or sensitive credentials
- Follow Instagram's API usage guidelines and rate limits
- Adhere to BISO's security protocols

## ⚠️ Rate Limits

- Be aware of Instagram Graph API rate limits
- Implement appropriate caching strategies
- Handle rate limit errors gracefully

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