import { createAdminClient, createSessionClient, ID, Permission, Query, Role } from "@biso/appwrite";

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

    log('Starting function execution'); // Initial log to indicate the function has started

    if (req.method !== 'POST') {
        log('Invalid request method');
        return res.json({ error: 'Method Not Allowed' });
    }

    log('On User Created POST request');

    log('Request body received: ' + JSON.stringify(req.body)); // Log the request body for debugging

    const { userId } = req.body;

    log('Creating admin client');
    const { databases, users } = await createAdminClient();
    log('Admin client created successfully');

    log('Checking for existing user document with ID: ' + userId);
    const existingUser = await databases.getDocument('app', 'user', userId);
    if (existingUser.$id) {
        log('Existing document found: ' + JSON.stringify(existingUser));
        return res.json({ status: 'ok', exists: true });
    } else {
        log('No existing document found for user ID: ' + userId);
    }

    log('Fetching account details for user ID: ' + userId);
    const account = await users.get(userId);
    log('Account details retrieved: ' + JSON.stringify(account));

    if (!account.email) {
        log('User has no email address');
        return res.json({ error: 'User has no email address' });
    } else {
        log('User email found: ' + account.email);
    }

    log('Creating new user document for user ID: ' + userId);
    const userDoc = await databases.createDocument('app', 'user', userId, {
        email: account.email
    }, [
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId))
    ]);
    log('User document created successfully: ' + JSON.stringify(userDoc));

    log('Function execution complete, returning response');
    return res.json({ status: 'ok', exists: false, userDoc, account });
}
