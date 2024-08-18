import { getContentByHashtag } from "@biso/instagram";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
    log('On Instagram Posts by Hashtag POST request');

    const { hashtag } = req.body;

    if (!hashtag) {
        log('Missing required parameters');
        return res.json({ error: 'Missing required parameters' });
    }

    const content = await getContentByHashtag(hashtag);

    return res.json({ content });
}