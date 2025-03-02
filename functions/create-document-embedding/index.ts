import { initVectorStore } from "@biso/ai";
import { createAdminClient } from "@biso/appwrite";

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {

    const { body } = req;
    log("Parsing request body...");
    log(body);
    
    return res.json({ message: "Document embedding created" });
}   