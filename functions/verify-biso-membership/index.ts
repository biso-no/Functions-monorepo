import { soapClient } from "@biso/twentyfour";
import { Query, createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
    // Log incoming request
    log(`Incoming request body: ${JSON.stringify(req.body)}`);
    
    const snumber = req.body;
    const cleanedSnumber = snumber.toString().replace(/[^0-9]/g, '');
    const studentId = parseInt(cleanedSnumber, 10);
    log(`Processed student ID: ${studentId}`);

    const { databases } = await createAdminClient();
    const { getAccessToken, userCategories } = soapClient(error, log);

    // Fetch active memberships
    log('Fetching active memberships...');
    const memberships = await databases.listDocuments('app', 'memberships', [
        Query.equal('status', true),
        Query.select(['$id', 'membership_id', 'name', 'price', 'category', 'status', 'expiryDate']),
    ]);
    log(`Found ${memberships.documents?.length || 0} active memberships`);
    log(`Active memberships: ${JSON.stringify(memberships.documents)}`);

    if (!memberships.documents || memberships.documents.length === 0) {
        log('No active memberships found in database');
        return res.json({ error: 'No active memberships found' });
    }

    // Get access token
    log('Retrieving 24SevenOffice access token...');
    const accessToken = await getAccessToken();
    log(`Access token status: ${accessToken.status}`);
    
    if (accessToken.status !== 'ok') {
        log('Failed to retrieve access token from 24SevenOffice');
        return res.json({ error: 'Failed to retrieve access token' });
    }

    // Get customer categories
    log(`Fetching categories for student ID: ${studentId}`);
    const customerCategories = await userCategories(accessToken.accessToken, studentId);
    log(`Customer categories response: ${JSON.stringify(customerCategories)}`);
    
    if (customerCategories.status !== 'ok') {
        log(`Failed to retrieve customer categories. Status: ${customerCategories.status}`);
        return res.json({ error: 'Failed to retrieve customer categories' });
    }

    // Sort memberships
    log('Sorting memberships by expiry date...');
    const sortedMemberships = memberships.documents
        .sort((a, b) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime());
    log(`Sorted memberships: ${JSON.stringify(sortedMemberships)}`);

    // Find matching membership
    log('Looking for matching membership...');
    const latestMembership = sortedMemberships.find(membership => {
        const membershipName = membership.name.toLowerCase();
        const hasMatch = customerCategories.data.some((category: any) => 
            category.toLowerCase() === membershipName
        );
        log(`Checking membership "${membershipName}" - Match found: ${hasMatch}`);
        return hasMatch;
    });

    if (latestMembership) {
        log(`Found matching membership: ${JSON.stringify(latestMembership)}`);
        return res.json({ membership: latestMembership });
    } else {
        log('No matching membership found for user categories');
        return res.json({ error: 'No active membership found for this user' });
    }
};