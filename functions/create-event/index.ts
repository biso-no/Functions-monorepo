import { createAdminClient } from "@biso/appwrite";

interface Event {
    event: string;
    data: {
        id: number;
        date: string;
        slug: string;
        status: string;
        link: string;
        title: {
            rendered: string;
        };
        content: {
            rendered: string;
        };
    }
    organizer_name: string;
}

interface Context {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};
function getCampusIdFromOrganizerSlug(slug: string) {
    const campusMapping = {
        'biso-oslo': 1,
        'biso-bergen': 2,
        'biso-stavanger': 3,
        'biso-trondheim': 4,
        'biso-national': 5
    } as const;
    
    // Return the corresponding campus ID or undefined if the slug doesn't match
    return campusMapping[slug as keyof typeof campusMapping];
}
export default async ({ req, res, log, error }: Context) => {

    log('Request received' + JSON.stringify(req.body));

    if (req.method === 'GET') {
        return res.json({ message: 'Not allowed.' });
    }

    const { 
        event,
        data: {
            id,
            date,
            slug,
            status,
            link,
            title,
            content,
        },
        organizer_name
    } = req.body as Event;

    if (event === 'event_created') {
        const client = createAdminClient();

        try {
            const event = (await client).databases.createDocument('app', 'events', id.toString(), {
                title: title.rendered,
                description: content.rendered,
                event_date: date,
                campus_id: getCampusIdFromOrganizerSlug(organizer_name),
                campus: getCampusIdFromOrganizerSlug(organizer_name),
                url: link,
                slug,
                status
            }

            );
            log('Event response: ' + JSON.stringify(event));
            return res.json({ message: 'Event created successfully' });
        } catch (error) {
            return res.json({ message: 'Event creation failed', error });
        }
    }

    if (event === 'event_updated') {
        const client = createAdminClient();

        try {
            const event = (await client).databases.updateDocument('app', 'events', id.toString(), {
                title: title.rendered,
                description: content.rendered,
                event_date: date,
                campus_id: getCampusIdFromOrganizerSlug(organizer_name),
                campus: getCampusIdFromOrganizerSlug(organizer_name),
                url: link,
                slug,
                status
            });
            log('Event response: ' + JSON.stringify(event));
            return res.json({ message: 'Event updated successfully' });
        } catch (error) {
            return res.json({ message: 'Event update failed', error });
        }
    }

    res.json({ message: 'Event not found' });

}