import { createAdminClient } from "@biso/appwrite";
import { soapClient } from "@biso/twentyfour";


type Context = {
  req: any;
  res: any;
  log: (msg: any) => void;
  error: (msg: any) => void;
};

export default async ({ req, res, log, error }: Context) => {
  const client = await soapClient(error,log);
  if (!client) {
    error("No client found");
  }
  try {
    const token =await client.getAccessToken()
    const {databases} = await createAdminClient()
    const departmentsArray = await client.getDepartments(token.accessToken);
      //Create a document in the database for each customer
      if(departmentsArray){
        for (const department of departmentsArray) {
            await databases.createDocument('24so', 'departments', department.Id, {
              Id: department.Id,
              Name: department.Name,
              Campus: department.Campus
            });
          }
          
        res.json(departmentsArray);
      }

  } catch (err) {
    error(err);
  }
}

