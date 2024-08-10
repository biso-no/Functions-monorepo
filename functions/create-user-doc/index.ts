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

    if (req.method !== 'POST') {
        log('Invalid request method');
        return res.json({ error: 'Method Not Allowed' });
    }

    log('On User Created POST request');

    log(req.body);

    const { userId } = req.body;

    const { databases, users } = await createAdminClient();

    const existingUser = await databases.getDocument('app', 'user', userId);
    if (existingUser.$id) {
        log('Existing document check complete: ' + JSON.stringify(existingUser));
        return res.json({ status: 'ok', exists: true });
    }

    const account = await users.get(userId);
    if (!account.email) {
        log('User has no email address');
        return res.json({ error: 'User has no email address' });
    }

    const userDoc = await databases.createDocument('app', 'user', userId, {
        email: account.email
    }, [
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId))
    ]);
    log('Created user document: ' + JSON.stringify(userDoc));
    return res.json({ status: 'ok', exists: false, userDoc, account });
}