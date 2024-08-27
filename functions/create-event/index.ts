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
    log('Request received with method: ' + req.method + ' and body: ' + JSON.stringify(req.body));

    if (req.method === 'GET') {
        log('GET method not allowed');
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

    log(`Processing event: ${event} for organizer: ${organizer_name} with ID: ${id}`);

    const client = createAdminClient();

    if (event === 'event_created') {
        log('Starting event creation process');

        try {
            const eventResponse = await (await client).databases.createDocument('app', 'event', id.toString(), {
                title: title.rendered,
                description: content.rendered,
                event_date: date,
                campus_id: getCampusIdFromOrganizerSlug(organizer_name),
                campus: getCampusIdFromOrganizerSlug(organizer_name),
                url: link,
                slug,
                status
            });
            log('Event created successfully with response: ' + JSON.stringify(eventResponse));
            return res.json({ message: 'Event created successfully' });
        } catch (err) {
            error('Event creation failed: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
            return res.json({ message: 'Event creation failed', error: err });
        }
    }

    if (event === 'event_updated') {
        log('Starting event update process');

        try {
            const eventResponse = await (await client).databases.updateDocument('app', 'events', id.toString(), {
                title: title.rendered,
                description: content.rendered,
                event_date: date,
                campus_id: getCampusIdFromOrganizerSlug(organizer_name),
                campus: getCampusIdFromOrganizerSlug(organizer_name),
                url: link,
                slug,
                status
            });
            log('Event updated successfully with response: ' + JSON.stringify(eventResponse));
            return res.json({ message: 'Event updated successfully' });
        } catch (err) {
            error('Event update failed: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
            return res.json({ message: 'Event update failed', error: err });
        }
    }

    log('Event not found or unsupported event type: ' + event);
    return res.json({ message: 'Event not found' });
}
