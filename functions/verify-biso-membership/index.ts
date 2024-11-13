import { soapClient } from "@biso/twentyfour";
import { Query, createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
    const snumber = req.body;

    const cleanedSnumber = snumber.toString().replace(/[^0-9]/g, '');
    const studentId = parseInt(cleanedSnumber, 10);

    const { databases } = await createAdminClient();
    const { getAccessToken, userCategories } = soapClient(error, log);

    // Fetch active memberships with expiry dates from the database
    const memberships = await databases.listDocuments('app', 'memberships', [
        Query.equal('status', true),
        Query.select(['$id', 'membership_id', 'name', 'price', 'category', 'status', 'expiryDate']),
    ]);

    if (!memberships.documents || memberships.documents.length === 0) {
        return res.json({ error: 'No active memberships found' });
    }

    // Get access token for 24SevenOffice
    const accessToken = await getAccessToken();
    if (accessToken.status !== 'ok') {
        return res.json({ error: 'Failed to retrieve access token' });
    }

    // Get customer categories
    const customerCategories = await userCategories(accessToken.accessToken, studentId);
    if (customerCategories.status !== 'ok') {
        return res.json({ error: 'Failed to retrieve customer categories' });
    }

    // Sort memberships by expiry date (newest first)
    const sortedMemberships = memberships.documents
        .sort((a, b) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime());

    // Find the first membership that matches any of the customer's categories
    const latestMembership = sortedMemberships.find(membership => 
        customerCategories.data.some((category: any) => 
            category.toLowerCase() === membership.name.toLowerCase()
        )
    );

    return latestMembership 
        ? res.json({ membership: latestMembership })
        : res.json({ error: 'No active membership found for this user' });
};