import { createSessionClient } from './index.js';
import { ID, Permission, Role, Models } from 'node-appwrite';


export async function createTeam(jwt: string, teamName: string, users?: Models.Document[], emails?: string[]) {

    const { account, databases, storage, teams } = await createSessionClient(jwt);

    const user = await account.get();

    const teamId = ID.unique();
    const team = await teams.create(teamId, teamName);
    
    if (team.$id) {
        const teamDocument = await databases.updateDocument('app', 'user', user.$id, { chats: [
            {
            name: teamName
            }
        ] }, [
            Permission.read(Role.team(teamId)),
            Permission.update(Role.team(teamId)),
            Permission.delete(Role.user(user.$id)),
            Permission.write(Role.team(teamId)),
        ]);

        await databases.updateDocument('app', 'user', user.$id, { chats: [teamId] });

        if (users) {
            for (const user of users) {
                await teams.createMembership(teamId, [], "", user.$id, undefined, "https://669544b0281f8e2277e6.appwrite.biso.no/");
            }
        }

        if (emails) {
            for (const email of emails) {
                const membership = await teams.createMembership(teamId, [], email, undefined, undefined, "https://669544b0281f8e2277e6.appwrite.biso.no/");
            }
        }
    }

    return teamId;
}
