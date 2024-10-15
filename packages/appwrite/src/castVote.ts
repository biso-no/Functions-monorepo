import { ID, Permission, Role, Models } from 'node-appwrite';
import { createAdminClient } from './index.js';

export async function castVote({
    optionId,
    voterId,
    electionId,
    votingSessionId,
    votingItemId,
    weight
    }: {
        optionId: string,
        voterId: string,
        electionId: string,
        votingSessionId: string,
        votingItemId: string,
        weight: number,
        voter: Models.Document
}) {
    const { databases } = await createAdminClient();

    const voter = await databases.getDocument('app', 'election_users', voterId)

    if (voter.canVote === false) return null;

            try {
            const castVote = await databases.createDocument('app', 'election_vote', ID.unique(), {
                optionId,
                voterId,
                electionId,
                votingSessionId,
                votingItemId,
                weight,
                voter: voter.$id
            }, [
                Permission.read(Role.user(voterId)),
                Permission.read(Role.team(electionId, 'owner')),
                Permission.delete(Role.user(electionId, 'owner')),
            ]);

            return castVote;
        }
        catch (err: any) {
            console.log(err);
            return null;
        }
}