import { soapClient } from "@biso/twentyfour";
import { Query, createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
    log(`Incoming request body: ${JSON.stringify(req.body)}`);
    
    const snumber = req.body;
    const cleanedSnumber = snumber.toString().replace(/[^0-9]/g, '');
    const studentId = parseInt(cleanedSnumber, 10);
    log(`Processing request for student ID: ${studentId}`);

    const { databases } = await createAdminClient();
    const { getAccessToken, userCategories } = soapClient(error, log);

    // Fetch active memberships
    log('Fetching active memberships from database...');
    const memberships = await databases.listDocuments('app', 'memberships', [
        Query.equal('status', true),
        Query.select(['$id', 'membership_id', 'name', 'price', 'category', 'status', 'expiryDate']),
    ]);

    if (!memberships.documents || memberships.documents.length === 0) {
        log('No active memberships found in database');
        return res.json({ error: 'No active memberships found' });
    }

    log('Available memberships in database:');
    memberships.documents.forEach(m => {
        log(`- ID: ${m.$id}, Name: "${m.name}", Category: ${m.category}, Expiry: ${m.expiryDate}`);
    });

    // Get access token
    log('Getting 24SevenOffice access token...');
    const accessToken = await getAccessToken();
    if (accessToken.status !== 'ok') {
        log('Failed to retrieve 24SevenOffice access token');
        return res.json({ error: 'Failed to retrieve access token' });
    }

    // Get customer categories
    log(`Fetching categories from 24SevenOffice for student ${studentId}...`);
    const customerCategories = await userCategories(accessToken.accessToken, studentId);
    
    if (customerCategories.status !== 'ok') {
        log(`Failed to retrieve customer categories. Error: ${JSON.stringify(customerCategories)}`);
        return res.json({ error: 'Failed to retrieve customer categories' });
    }

    // Log the categories from 24SevenOffice
    log('Category IDs from 24SevenOffice:');
    const categoryIds = customerCategories.data;
    categoryIds.forEach((categoryId: number) => {
        log(`- Category ID: ${categoryId}`);
    });

    // Sort memberships by expiry date
    const sortedMemberships = memberships.documents
        .sort((a, b) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime());

    // Find matching membership with detailed logging
    log('Attempting to match 24SevenOffice category IDs with database memberships...');
    const latestMembership = sortedMemberships.find(membership => {
        const dbCategory = membership.category;
        log(`\nChecking membership: "${membership.name}" (Category: ${dbCategory})`);
        
        const hasMatch = categoryIds.some((categoryId: number) => {
            const isMatch = categoryId.toString() === dbCategory;
            log(`- Comparing with 24SevenOffice category ID: ${categoryId} -> ${isMatch ? 'MATCH' : 'no match'}`);
            return isMatch;
        });

        return hasMatch;
    });

    if (latestMembership) {
        log(`Found matching membership: ${JSON.stringify(latestMembership)}`);
        return res.json({ membership: latestMembership });
    } else {
        log('No matching membership found. Categories available:');
        log(`Database membership categories: ${memberships.documents.map(m => m.category).join(', ')}`);
        log(`24SevenOffice category IDs: ${categoryIds.join(', ')}`);
        return res.json({ error: 'No active membership found for this user' });
    }
};