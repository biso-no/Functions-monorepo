import { FacebookAdsApi, IGMedia, InstagramMedia, IGUser } from 'facebook-nodejs-business-sdk';

const accessToken = process.env.FACEBOOK_ACCESS_TOKEN!;
const api = new FacebookAdsApi(accessToken);
const user = new IGUser(null, undefined, null, api);
export async function getMedia({
    hashtag
}: {
    hashtag?: string;
}) {
    const medias = await user.getMedia([], undefined, true);
    return medias;
}