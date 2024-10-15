import { castVote, Models } from '@biso/appwrite';

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface IncomingVote {
    optionId: string;
    voterId: string;
    electionId: string;
    votingSessionId: string;
    votingItemId: string;
    weight: number;
}

export default async ({ req, res, log, error }: Context) => {
    try {

        log('Parsing request body...');
        const body = JSON.parse(req.body);
        const votes = body.votes as IncomingVote[] | undefined;

        if (!votes) {
            log('No votes provided.');
            return res.json({ error: 'No votes provided' });
        }

        log('Casting votes...');
        for (const vote of votes) {
            const castedVote = await castVote({
                optionId: vote.optionId,
                voterId: vote.voterId,
                electionId: vote.electionId,
                votingSessionId: vote.votingSessionId,
                votingItemId: vote.votingItemId,
                weight: vote.weight,
                voter: body.voter
            });
            if (castVote) {
                log('Vote cast: ' + JSON.stringify(castVote));
            } else {
                log('Vote not cast.');
                return res.json({ error: 'Vote not cast' });
            }
            
        }
        log('Votes cast.');
        return res.json({ success: 'Votes cast' });
    }
    catch (err: any) {
        log('An error occurred: ' + err);
        return res.json({ error: (err as Error).message });
    }
}