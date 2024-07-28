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

    const { id, date, link, slug, status, content, acf, title } = req.body.data as Post;

    const client = await createAdminClient();

    let department;
    switch (acf.campus.value) {
        case '1':
            department = acf.department_oslo?.value;
            break;
        case '2':
            department = acf.department_bergen?.value;
            break;
        case '4':
            department = acf.department_stavanger?.value;
            break;
        case '3':
            department = acf.department_trondheim?.value;
            break;
        case '5':
            department = acf.department_national?.value;
            break;
        default:
            department = null; // or handle the case when department is not available
    }

    if (req.method === 'PATCH') {
        const contentBody = content.rendered;
        const post = await client.databases.createDocument('app', 'news', id.toString(), {
            content: contentBody,
            title: title.rendered,
            slug,
            url: link,
            created_at: date,
            status,
            campus: acf.campus.value,
            campus_id: acf.campus.value,
            department: department,
            department_id: department
        });

        return res.json({ post });
    }

    if (req.method === 'POST') {
        res.json({ error: 'Not implemented' });
    }

    if (req.method === 'DELETE') {

        if (!id) {
            return res.json({ error: 'No ID provided' });
        }

        const post = await client.databases.deleteDocument('app', 'news', id.toString());
        return res.json({ post });
    }

    res.json({ error: 'Not implemented' });

};