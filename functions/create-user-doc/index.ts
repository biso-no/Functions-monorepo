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

    const { $id, email } = req.body as UserDoc;
    log('Parsed post data: ' + JSON.stringify(req.body));

    //Path to image url: "yoast_head_json.schema.@graph[2].url"


    const { databases } = await createSessionClient(req.headers['x-appwrite-user-jwt']!);

    if ($id && email) {
    
        const existingDoc = await databases.getDocument('app', 'user', $id, [
            Query.equal('email', email),
            Query.select(['email', '$id'])
        ]);
        if (existingDoc.$id) {
            return res.json({ status: 'ok', exists: true });
        }

    const userDoc = await databases.createDocument('app', 'user', $id, {
        email
    });
    log('Created user document: ' + JSON.stringify(userDoc));

    const user = await databases.getDocument('app', 'user', userDoc.$id);
    log('Retrieved user document: ' + JSON.stringify(user));

    return res.json({ status: 'ok', exists: false });
    } else if (!email && !$id) {
        return res.json({ error: 'No email or ID provided' });
    }
}