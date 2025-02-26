
import { Context } from '@biso/types';
import { createAdminClient } from '@biso/appwrite';
import { OAuthProvider } from '@biso/appwrite';
import { Client } from '@biso/appwrite';
const sessionClient = new Client()
.setEndpoint('https://appwrite.biso.no/v1')
.setProject('biso');

export default async ({ req, res, log, error }: Context) => {
  const {account} = await createAdminClient()


    log("Received request");
    log("BODY: " + JSON.stringify(req.body));
    log("Request Params: " + JSON.stringify(req.params));

    const jwt = req.headers['x-appwrite-user-jwt'] as string;

    log("Extracted JWT from headers: " + jwt);

    if (!jwt) {
        log("No JWT found");
        return res.json({
            error: 'JWT not found',
            status: 404
        });
    }

    log("Setting JWT for session client");
    sessionClient.setJWT(jwt);

    const session = await account.listSessions();

    if (session.sessions.length > 0) {
        sessionClient.setSession(session.sessions[0].$id);

    try {
        log("Requesting OAuth2 token");
        const url = await account.createOAuth2Token(OAuthProvider.Microsoft, "https://669fe56b2ddb82b59221.appwrite.biso.no/");
        
        log("Received OAuth2 token: " + url);
        return res.send(url);
    } catch (e) {
        log("Error occurred: " + e);
        return res.json({
            error: 'Error',
            status: 500
        });
    }
    }
}