import { soapClient } from "@biso/twentyfour";
import { Query, createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface RequestBody {
    snumber: string;
}

export default async ({ req, res, log, error }: Context) => {

    const snumber = req.body;

    const cleanedSnumber = snumber.replace(/[^0-9]/g, '');
    const studentId = parseInt(cleanedSnumber, 10);

    const { databases } = await createAdminClient();
    const { getAccessToken, userCategories } = soapClient(error, log);

    // Fetch active memberships from the database
    const memberships = await databases.listDocuments('app', 'memberships', [
        Query.equal('status', true),
        Query.select(['$id', 'membership_id', 'name', 'price', 'category', 'status', 'expiryDate']),
    ]);

    if (!memberships.documents || memberships.documents.length === 0) {
        log('No active memberships found in the database');
    }

    // Fetch user categories from 24SevenOffice
    const accessToken = await getAccessToken();
    if (accessToken.status !== 'ok') {
        log('Failed to retrieve access token');
        return res.json({ error: 'Failed to retrieve access token' });
    }

    const customerCategories = await userCategories(accessToken.accessToken, studentId);
    if (customerCategories.status !== 'ok') {
        log('Failed to retrieve customer categories');
        return res.json({ error: 'Failed to retrieve customer categories' });
    }

    // Match user categories to active memberships
    const matchedMembership = memberships.documents.find(membership => {
        return customerCategories.data.some((category: any) => 
            category.toLowerCase() === membership.name.toLowerCase()
        );
    });

    if (matchedMembership) {
        // Filter out memberships without a valid expiryDate, just in case
        const sortedMemberships = memberships.documents
            .filter(m => m.name.toLowerCase() === matchedMembership.name.toLowerCase() && m.expiryDate)
            .sort((a, b) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime());
        
        // Check if there's at least one valid membership after filtering
        if (sortedMemberships.length > 0) {
            const latestMembership = sortedMemberships[0]; // Pick the one with the latest expiry date
            return res.json({ membership: latestMembership });
        } else {
            log('No valid memberships with an expiry date found for this user');
            return res.json({ error: 'No valid membership found for this user' });
        }
    } else {
        return res.json({ error: 'No active membership found for this user' });
    }
};
