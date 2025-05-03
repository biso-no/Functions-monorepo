import { Client, Databases, Storage } from 'node-appwrite';
import { Context } from '@biso/types';
import { createAdminClient } from '@biso/appwrite';


export default async ({ req, res, log, error }: Context) => {
  try {
    // Initialize Appwrite client


    const {databases} = await createAdminClient();

    log(req)

    return res.json({
      status: 'ok',
    });

  } catch (err: any) {
    error(err.message || err);
    return res.json({ error: err.message || err });
  }
}