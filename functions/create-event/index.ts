import { createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface Post {
    id: number;
    date: string;
    link: string;
    slug: string;
    status: string;
    title: Content;
    content: Content;
    acf: Acf;
}

interface Content {
    rendered: string;
}

interface Acf {
    campus: {
        value: string;
        label: string;
    };
    department_oslo?: {
        value: string;
        label: string;
    };
    department_bergen?: {
        value: string;
        label: string;
    };
    department_stavanger?: {
        value: string;
        label: string;
    };
    department_trondheim?: {
        value: string;
        label: string;
    };
    department_national?: {
        value: string;
        label: string;
    }
}


export default async ({ req, res, log, error }: Context) => {

    log('Request received' + req.body);

    if (req.method === 'GET') {
        return res.json({ message: 'Not allowed.' });
    }

    const { 
        id, 
        title, 
        content, 
        start_date, 
        end_date, 
        location, 
        venue,
        organizer,
        cost,
        url,
        primary_image: image
    } = req.body;
    
    if (req.method === 'POST') {
    const client = createAdminClient();

    const event = (await client).databases.createDocument('app', 'events', id, {
        title,
        description: content,
        event_date: start_date,
        image,
        campus_id: getCampusIdFromOrganizerSlug(organizer),
        campus: getCampusIdFromOrganizerSlug(organizer),
        price: cost,
        url,
    });
    log('Event created' + JSON.stringify(event));
    



        return res.json(event);
    }

}
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