
import { Context } from '@biso/types';
import { createAdminClient } from '@biso/appwrite';
import { ID } from '@biso/appwrite';

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }: Context) => {
  // Why not try the Appwrite SDK?
  //


  const {messaging, teams} = await createAdminClient()

  if (req.body.chat_id) {
    try {
      const team = await teams.get(req.body.chat_id);
      const users = await teams.listMemberships(req.body.chat_id);

      // Extract the sender's user ID from the request body
      const senderId = req.body.users.$id;

      // Collect all user IDs except the sender's
      const userIds = users.memberships
        .map(user => user.userId)
        .filter(userId => userId !== senderId);

      // Log the array of userIds
      log(userIds);

      // Send push notification to all users except the sender
      await messaging.createPush(
        ID.unique(),
        'A new message @ ' + team.name,
        req.body.content,
        [],
        userIds,
        [],
        {
          href: 'chat/' + req.body.chat_id,
          title: 'New message @ ' + team.name,
          message: req.body.content,
        }
      );

      return res.json({ message: 'Notifications were sent to all users in team: ' + team.name });
    } catch (err) {
      if (err instanceof Error) {
        error('Failed to send notifications: ' + err.message);
        return res.send('Failed to send notifications: ' + err.message);
      } else {
        error('An unknown error occurred');
        return res.send('An unknown error occurred');
      }
    }
  } else {
    error('No chat ID provided');
    return res.send('No chat ID provided');
  }
}