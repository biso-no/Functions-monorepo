import { createAdminClient, createSessionClient, ID, Query } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface UserDoc {
    userId: string;
    email: string;
}

export default async ({ req, res, log, error }: Context) => {

    if (req.method !== 'POST') {
        log('Invalid request method');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    log('On User Created POST request');

    let body;
    try {
        body = JSON.parse(req.body);
    } catch (e) {
        log('Invalid JSON in request body');
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    const { userId, email } = body;

    if (!userId || !email) {
        log('No userId or email provided');
        return res.status(400).json({ error: 'No userId or email provided' });
    }

    const { databases } = await createSessionClient(req.headers['x-appwrite-user-jwt']);

    try {
        const existingDoc = await databases.getDocument('app', 'user', userId);
        log('Existing document check complete: ' + JSON.stringify(existingDoc));
        return res.json({ status: 'ok', exists: true });
    } catch (err: any) {
        log('Document does not exist, creating new user document');
        try {
            const userDoc = await databases.createDocument('app', 'user', userId, {
                email
            });
            log('Created user document: ' + JSON.stringify(userDoc));
            return res.json({ status: 'ok', exists: false });
        } catch (e) {
            log('Failed to create user document');
            return res.status(500).json({ error: 'Failed to create user document' });
        }
    }
};
