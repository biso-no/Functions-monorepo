
import { Context } from '@biso/types';


export default async ({ req, res, log, error }: Context) => {

    log('Request received');
    
    const { userId, secret } = req.query;
    log(`Parsed request query parameters: userId = ${userId}, secret = ${secret}`);
    
    const jwt = req.url.split('/')[1];
    log(`Extracted JWT from URL: ${jwt}`);

    if (req.method === 'GET' && userId && secret) {
        log('Request method is GET and has userId and secret. Redirecting...');
        return res.redirect('biso://oauth/success?userId=' + userId + '&secret=' + secret);
    }

    log('Request did not match expected criteria');
};