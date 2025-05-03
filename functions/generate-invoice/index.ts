
import { createAdminClient } from "@biso/appwrite";
import axios from 'axios';
import { Context, Expense } from '@biso/types';


 

 
// This is your Appwrite function 
// It's executed each time we get a request 
export default async ({ req, res, log, error }: Context) => { 
  try { 
    log('Request body:' + JSON.stringify(req.body));
   

    const {databases} = await createAdminClient()

    const expense = req.body as Expense

    if (!expense) { 
      return res.json({ 
        error: 'Expense not found' 
      }); 
    }

    const fullName = expense.user.name;
    const firstName = fullName?.split(' ')[0]; 
    const lastName = fullName?.split(' ')[1]; 

    log(`Expense details: ${JSON.stringify(expense)}`);

    // If prepayment_amount is larger than 0, then let prepayment variable be true.
    const prepaymentBool = expense?.prepayment_amount > 0;
    const paymentBoolToString = prepaymentBool ? 'true' : 'false';

    // Outstanding value is total - prepayment, if there is a prepayment. Otherwise it's just the total.
    const outstanding = prepaymentBool ? expense?.total - expense?.prepayment_amount : expense?.total;

    log("Processed prepayment and outstanding amounts");
    log(`Prepayment: ${paymentBoolToString}, Outstanding: ${outstanding}`);

    log("Request body:");
    log(req.body);

    // Map the attachments to the required format
    const formattedAttachments = expense?.expenseAttachments?.map((attachment: any) => ({
      attachmentDescription: attachment.description,
      dateOfAttachment: attachment.date,
      amount: attachment.amount.toString(),
      image: attachment.url,
      type: attachment.type
    })) || [];
    
    log("Formatted attachments:");
    log(formattedAttachments);

    const powerAutomateData = { 
      firstname: firstName, 
      lastname: lastName, 
      address: expense.user.address,
      phone: expense.user.phone,
      city: expense.user.city,
      zip: expense.user.zip,
      email: expense.user.email,
      bank: expense?.bank_account, 
      org: 'biso', 
      campus: expense?.campus, 
      purpose: expense?.description, 
      unit: expense?.department, 
      date: expense?.$createdAt, 
      prepayment: paymentBoolToString,
      prepaymentAmount: expense?.prepayment_amount.toString(), 
      attachments: formattedAttachments, 
      total: expense?.total.toString(), 
      outstanding: outstanding.toString() 
    }; 

    log("Power Automate data prepared:");
    log(powerAutomateData);

    log("Sending data to Power Automate");
    const response = await axios.post(process.env.POWERAUTOMATE_URL!, powerAutomateData);

    if (response.status !== 200) { 
      error(response.data); 
      log("Error response from Power Automate:");
      log(response.data);
      return res.json({ 
        error: response.data 
      }); 
    }

    log("Data sent to Power Automate successfully");
    log(`Power Automate response: ${JSON.stringify(response.data)}`);

    log("Updating document in Appwrite database");
    const document = await databases.updateDocument('app', 'expense', expense.$id, {
      status: 'submitted',
      invoice_id: response.data.invoiceId
    });

    log("Document updated successfully");
    log(`Updated document: ${JSON.stringify(document)}`);

    return res.json({
      status: 'ok'
    });

  } catch (err: any) {
    error(err);
    log("An error occurred:");
    log(err);
    return res.json({ 
      error: err 
    });
  } 
}