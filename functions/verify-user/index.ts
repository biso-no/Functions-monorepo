import { Context } from "@biso/types";

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }: Context) => {
  try {

    if (req.method !== 'GET') {
      res.json({ error: 'Method not allowed' });
      return;
    }


    const { membershipId, userId, secret, teamId } = req.query;

    if (!membershipId || !userId || !secret || !teamId) {
      res.json({ error: 'Missing parameters' });
      return;
    }

    const url = `biso://chat/invite?membershipId=${membershipId}&userId=${userId}&secret=${secret}&teamId=${teamId}`;
    return res.redirect(url);
  } catch (error) {
    log(error);
    return res.json({ status: 'unsuccessful' });
  }
};
    