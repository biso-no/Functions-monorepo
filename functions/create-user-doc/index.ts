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
    try {
        
        const { userId, email } = req.body
        log('UserID: ' + userId);
        log('Email: ' + email);
        log('Request body: ' + JSON.stringify(req.body));

        if (!userId || !email) {
            log('No userId or email provided');
            return res.json({ error: 'No userId or email provided' });
        }

        log('Creating session client');
        const { databases } = await createSessionClient(req.headers['x-appwrite-user-jwt']!);
        log('Session client created');

        const existingDoc = await databases.getDocument('app', 'user', userId, [
            Query.equal('email', email),
            Query.select(['email', '$id'])
        ]);
        log('Existing document check complete: ' + JSON.stringify(existingDoc));
        
        if (existingDoc.$id) {
            log('Document already exists');
            return res.json({ status: 'ok', exists: true });
        }

        log('Creating new user document');
        const userDoc = await databases.createDocument('app', 'user', userId, {
            email
        });
        log('Created user document: ' + JSON.stringify(userDoc));

        return res.json({ status: 'ok', exists: false });
    } catch (err: any) {
        error('An error occurred: ' + (err as Error).message);
        return res.json({ error: 'An internal error occurred' });
    }
}