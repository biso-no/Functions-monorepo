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
    log('Parsed body: ' + JSON.stringify(body));
    const { email, $id } = body;

    if (!email) {
        log('No userId or email provided');
        return res.json({ error: 'No userId or email provided' });
    }

    const { databases } = await createAdminClient();

    const existingUser = await databases.getDocument('app', 'user', $id);
    if (existingUser.$id) {
        log('Existing document check complete: ' + JSON.stringify(existingUser));
        return res.json({ status: 'ok', exists: true });
    }

    const userDoc = await databases.createDocument('app', 'user', $id, {
        email
    });

    log('Created user document: ' + JSON.stringify(userDoc));
    return res.json({ status: 'ok', exists: false, userDoc });

};