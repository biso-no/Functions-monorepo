import { createTeam, Models } from '@biso/appwrite';

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
    try {


        log('Parsing request body...');
        const body = JSON.parse(req.body);
        const teamName = body.name as string;
        const users = body.users as Models.Document[] | undefined;
        const emails = body.emails as string[] | undefined;

        if (!users && !emails) {
            log('No users or emails provided.');
            return res.json({ error: 'No users or emails provided' });
        }

        log('Creating team...');
        const teamId = await createTeam(req.headers['x-appwrite-user-jwt']!, teamName, users, emails);

        log('Returning team ID...');
        return res.json({ teamId });
    } catch (err: any) {
        log('An error occurred: ' + err);
        return res.json({ error: (err as Error).message });
    }
};
