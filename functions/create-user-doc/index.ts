import { createAdminClient, createSessionClient, ID, Query } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface UserDoc {
    email: string;
}

export default async ({ req, res, log, error }: Context) => {

    if (req.method !== 'POST') {
        log('Invalid request method');
        return res.json({ error: 'Method Not Allowed' });
    }

    log('On User Created POST request');

    const body = JSON.parse(req.body);
    const { email } = body;

    if (!email) {
        log('No userId or email provided');
        return res.json({ error: 'No userId or email provided' });
    }

    const { databases, account } = await createSessionClient(req.headers['x-appwrite-user-jwt'] as string);
    const user = await account.get();

    let existingDoc;
    try {
        existingDoc = await databases.getDocument('app', 'user', user.$id);
        if (existingDoc) {
            log('Existing document check complete: ' + JSON.stringify(existingDoc));
            return res.json({ status: 'ok', exists: true });
        }
    } catch (e) {
        log('No existing document found, proceeding to create one.');
        const userDoc = await databases.createDocument('app', 'user', user.$id, {
            email
        });

        log('Created user document: ' + JSON.stringify(userDoc));
        return res.json({ status: 'ok', exists: false, userDoc });
    }
};