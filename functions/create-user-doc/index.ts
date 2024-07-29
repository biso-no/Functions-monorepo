import { createAdminClient, ID } from "@biso/appwrite";

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

    const { $id, email } = req.body.data as UserDoc;
    log('Parsed post data: ' + JSON.stringify(req.body.data));

    //Path to image url: "yoast_head_json.schema.@graph[2].url"


    const { databases } = await createAdminClient();

    if ($id && email) {
    
    const userDoc = await databases.createDocument('app', 'user', $id, {
        email
    });
    log('Created user document: ' + JSON.stringify(userDoc));

    const user = await databases.getDocument('app', 'user', userDoc.$id);
    log('Retrieved user document: ' + JSON.stringify(user));

    return res.json({ user });
    } else if (!email && !$id) {
        return res.json({ error: 'No email or ID provided' });
    }
}