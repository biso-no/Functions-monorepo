import { Client, GetPageInfoRequest, GetPageMediaRequest } from 'instagram-graph-api';

const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN!;
const pageId = process.env.INSTAGRAM_PAGE_ID!;

const client: Client = new Client(accessToken, pageId);

export async function getContentByHashtag(hashtag: string): Promise<string> {
    const medias = await client.newGetHashtagIdRequest(hashtag, pageId).execute();
    const media = medias.getData()[0];

    if (!media) {
        throw new Error('Media not found');
    }

    const mediaId = media.id;
    const mediaInfo = await client.newGetMediaInfoRequest(mediaId).execute();

    if (!mediaInfo) {
        throw new Error('Media info not found');
    }
    const mediaContent = mediaInfo?.getData()?.caption

    if (!mediaContent) {
        throw new Error('Media content not found');
    }

    return mediaContent;
}