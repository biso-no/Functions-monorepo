import { ID, Permission, Role, Models } from 'node-appwrite';
import { createSessionClient } from './index.js';

export async function createTeam({
    jwt,
    teamName,
    users,
    emails,
    log
}: {
    jwt: string,
    teamName: string,
    users?: Models.Document[],
    emails?: string[],
    log: (msg: any) => void
}) {
    log('Creating session client...');
    const { account, databases, storage, teams } = await createSessionClient(jwt);
    log('Session client created.');

    log('Fetching user account...');
    const user = await account.get();
    log('User account fetched: ' + JSON.stringify(user));

    const teamId = ID.unique();
    log('Generated team ID: ' + teamId);

    log(`Creating team with name: ${teamName}...`);
    const team = await teams.create(teamId, teamName);
    log('Team created: ' + JSON.stringify(team));

    if (team.$id) {
        log('Updating user document with new team info...');
        const teamDocument = await databases.updateDocument('app', 'user', user.$id, {
            chats: [{
                name: teamName
            }]
        }, [
            Permission.read(Role.team(teamId)),
            Permission.update(Role.team(teamId)),
            Permission.delete(Role.user(user.$id)),
            Permission.write(Role.team(teamId))
        ]);
        log('User document updated: ' + JSON.stringify(teamDocument));

        log(`Adding team ID ${teamId} to user's chats...`);
        await databases.updateDocument('app', 'user', user.$id, { chats: [teamId] });
        log('Team ID added to user\'s chats.');

        if (users) {
            log('Adding users to the team memberships...');
            for (const user of users) {
                log(`Creating membership for user: ${user.$id}...`);
                await teams.createMembership(teamId, [], "", user.$id, undefined, "https://669544b0281f8e2277e6.appwrite.biso.no/");
                log(`Membership created for user: ${user.$id}`);
            }
        }

        if (emails) {
            log('Adding emails to the team memberships...');
            for (const email of emails) {
                log(`Creating membership for email: ${email}...`);
                await teams.createMembership(teamId, [], email, undefined, undefined, "https://669544b0281f8e2277e6.appwrite.biso.no/");
                log(`Membership created for email: ${email}`);
            }
        }
    }

    log('Team creation complete. Returning team ID: ' + teamId);
    return teamId;
}
