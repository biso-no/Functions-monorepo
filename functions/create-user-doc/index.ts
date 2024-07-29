import { createAdminClient, ID } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface UserDoc {
    id: number;
    email: string;
}

export default async ({ req, res, log, error }: Context) => {

    const { id, email } = req.body.data as UserDoc;
    log('Parsed post data: ' + JSON.stringify(req.body.data));

    //Path to image url: "yoast_head_json.schema.@graph[2].url"


    const { databases } = await createAdminClient();

    
    const userDoc = await databases.createDocument('app', 'user', ID.unique(), {
        email
    });
    log('Created user document: ' + JSON.stringify(userDoc));

    const user = await databases.getDocument('app', 'user', userDoc.$id);
    log('Retrieved user document: ' + JSON.stringify(user));

    return res.json({ user });

};