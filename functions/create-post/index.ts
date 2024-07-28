import { createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {

    log('Request received: ' + JSON.stringify(req));

    return res.json({ error: 'Not implemented' });
};