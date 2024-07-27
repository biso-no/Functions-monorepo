import { Client, Databases, Users, Account, Storage, Functions, Teams } from "node-appwrite";
import zod from "zod";

// Function to create a session client using JWT from headers
export async function createSessionClient(jwt: string) {
    const client = new Client()
        .setEndpoint('https://appwrite.biso.no/v1')
        .setProject('biso');
  
    client.setJWT(jwt);
  
    return {
        get account() {
            return new Account(client);
        },
        get databases() {
            return new Databases(client);
        },
        get users() {
            return new Users(client);
        },
        get storage() {
            return new Storage(client);
        },
        get functions() {
            return new Functions(client);
        },
        get teams() {
            return new Teams(client);
        }
    };
}
  
// Function to create an admin client using API key
export async function createAdminClient() {
    const client = new Client()
        .setEndpoint('https://appwrite.biso.no/v1')
        .setProject('biso')
        .setKey(process.env.API_KEY!);
  
    return {
        get account() {
            return new Account(client);
        },
        get databases() {
            return new Databases(client);
        },
        get users() {
            return new Users(client);
        },
        get storage() {
            return new Storage(client);
        },
        get functions() {
            return new Functions(client);
        }
    };
}
