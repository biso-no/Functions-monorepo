import { createAdminClient, createSessionClient, ID, Query } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface UserDoc {
    $id: string;
    email: string;
}

export default async ({ req, res, log, error }: Context) => {
    try {
        log('Starting function execution');

        const { $id, email } = req.body as UserDoc;
        log('Parsed post data: ' + JSON.stringify(req.body));

        //Path to image url: "yoast_head_json.schema.@graph[2].url"
        log('Creating session client');
        const { databases } = await createSessionClient(req.headers['x-appwrite-user-jwt']!);
        log('Session client created');

        if ($id && email) {
            log('Checking for existing document');
            const existingDoc = await databases.getDocument('app', 'user', $id, [
                Query.equal('email', email),
                Query.select(['email', '$id'])
            ]);
            log('Existing document check complete: ' + JSON.stringify(existingDoc));
            
            if (existingDoc.$id) {
                log('Document already exists');
                return res.json({ status: 'ok', exists: true });
            }

            log('Creating new user document');
            const userDoc = await databases.createDocument('app', 'user', $id, {
                email
            });
            log('Created user document: ' + JSON.stringify(userDoc));

            log('Retrieving user document');
            const user = await databases.getDocument('app', 'user', userDoc.$id);
            log('Retrieved user document: ' + JSON.stringify(user));

            return res.json({ status: 'ok', exists: false });
        } else if (!email && !$id) {
            log('No email or ID provided');
            return res.json({ error: 'No email or ID provided' });
        }
    } catch (err) {
        error('An error occurred: ' + err.message);
        return res.json({ error: 'An internal error occurred' });
    }
}