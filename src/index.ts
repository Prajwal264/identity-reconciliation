import express, { json, Request, Response } from "express";
import "reflect-metadata";
import { createConnection, Connection, Not, In } from "typeorm";
import { Contact } from "./entity/Contact";

interface IIdentityReconciliationRequest {
  email?: null | string,
  phoneNumber?: null | string
}

interface IConsolidatedContactResponse {
  primaryContatctId: number,
  emails: string[],
  phoneNumbers: string[],
  secondaryContactIds: number[],
}

const findContacts = async (conn: Connection, payload: IIdentityReconciliationRequest) => {
  const conditons = [];
  if (payload.phoneNumber) {
    conditons.push({ phoneNumber: payload.phoneNumber })
  }
  if (payload.email) {
    conditons.push({ email: payload.email })
  }
  let contacts = await conn.manager.find(Contact, {
    where: conditons,
    order: {
      linkPrecedence: 'ASC',
      createdAt: 'DESC'
    },
  });
  if (conditons.length === 1 && contacts.length) {
    const linkedContactsConditions: any[] = [{
      linkedId: contacts[0].linkedId || contacts[0].id,
    }];
    if (contacts[0].linkedId) {
      linkedContactsConditions.push({
        id: contacts[0].linkedId,
      });
    }
    const linkedContacts = await conn.manager.find(Contact, {
      where: linkedContactsConditions
    });
    contacts.push(...linkedContacts.filter((item) => (!contacts.find((i) => i.id === item.id))));
    if (linkedContactsConditions.length === 2) {
      contacts = contacts.sort((a, b) => a.linkPrecedence.localeCompare(b.linkPrecedence))
    }
  }
  return contacts;
}

const createContact = (conn: Connection, payload: IIdentityReconciliationRequest, linkPrecedence = 'primary', linkedId?: number) => {
  const contact = new Contact();
  contact.phoneNumber = payload.phoneNumber || null;
  contact.email = payload.email || null;
  contact.linkPrecedence = linkPrecedence;
  contact.linkedId = linkedId || null;
  contact.createdAt = new Date();
  contact.updatedAt = new Date();
  return conn.manager.save(contact)
}

const consolidateContactResponse = (contacts: Contact[]) => {
  if (contacts.length === 1) {
    const emails: string[] = []
    const phoneNumbers: string[] = []
    if (contacts[0].email) {
      emails.push(contacts[0].email);
    }
    if (contacts[0].phoneNumber) {
      phoneNumbers.push(contacts[0].phoneNumber);
    }
    return {
      primaryContatctId: contacts[0].id,
      emails,
      phoneNumbers,
      secondaryContactIds: []
    }
  }
  const consolidatedResponse = {
    emails: [],
    phoneNumbers: [],
    secondaryContactIds: []
  } as IConsolidatedContactResponse;
  for (const contact of contacts) {
    if (!consolidatedResponse.primaryContatctId) {
      consolidatedResponse.primaryContatctId = contact.id;
    }
    if (!consolidatedResponse.emails.includes(contact.email) && contact.email) {
      consolidatedResponse.emails.push(contact.email);
    }
    if (!consolidatedResponse.phoneNumbers.includes(contact.phoneNumber) && contact.phoneNumber) {
      consolidatedResponse.phoneNumbers.push(contact.phoneNumber);
    }
    if (contact.linkPrecedence !== 'primary') {
      consolidatedResponse.secondaryContactIds.push(contact.id);
    }
  }
  return consolidatedResponse;
}

const doesExactContactExist = (payload: IIdentityReconciliationRequest, contacts: Contact[]): Contact | undefined => {
  return contacts.find((contact) => contact.phoneNumber === payload.phoneNumber && contact.email === payload.email);
}

const checkIfPayloadHasNewInfo = (payload: IIdentityReconciliationRequest, contacts: Contact[]) => {
  let doesEmailMatch = false;
  let doesPhoneNumberMatch = false;
  for (const contact of contacts) {
    if (contact.email === payload.email) {
      doesEmailMatch = true;
    }
    if (contact.phoneNumber == payload.phoneNumber) {
      doesPhoneNumberMatch = true;
    }
  }
  let hasNewInfo = !doesEmailMatch || !doesPhoneNumberMatch;
  return hasNewInfo
}

const updateSecondaries = async (connection: Connection, contacts: Contact[]) => {
  // take the oldest one as primary and set others as secondary
  contacts.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  if (contacts[0].linkPrecedence !== 'primary') {
    contacts[0].linkedId = null;
    contacts[0].linkPrecedence = 'primary';
  }
  for (let i = 1; i < contacts.length; i++) {
    let contact = contacts[i];
    if (contact.linkPrecedence !== 'secondary') {
      contact.linkedId = contacts[0].id;
      contact.linkPrecedence = 'secondary';
      await connection.createQueryBuilder()
        .update(Contact)
        .set(contact)
        .where({ id: contact.id })
        .execute();
    }
  }
  return contacts;
}

createConnection()
  .then(async (connection) => {
    const app = express();

    app.use(json());

    app.post(
      "/identify",
      async (
        req: Request,
        res: Response,
      ): Promise<void> => {
        const payload = req.body as IIdentityReconciliationRequest;
        // Check if we can find any data with the email | phone number
        let contacts = await findContacts(connection, payload);
        // if we don't find the contacts we will create one
        if (!payload.email || !payload.phoneNumber) {
          const consolidatedContact = consolidateContactResponse(contacts);
          res.status(200).json({ contact: consolidatedContact });
          return;
        }
        if (!contacts?.length) {
          const contact = await createContact(connection, payload);
          const consolidatedContact = consolidateContactResponse([contact]);
          res.status(200).json({
            contact: consolidatedContact
          });
          return;
        }
        // contact already exist
        const exactContact = doesExactContactExist(payload, contacts);
        if (!exactContact) {
          // check if the new record is having new information
          const hasNewInfo = checkIfPayloadHasNewInfo(payload, contacts);
          if (hasNewInfo) {
            const contact = await createContact(connection, payload, 'secondary', contacts[0].id);
            contacts.push(contact);
          } else {
            contacts = await updateSecondaries(connection, contacts)
          }
        }
        const consolidatedContact = consolidateContactResponse(contacts);
        res.status(200).json({ contact: consolidatedContact });
      }
    );

    app.listen(3000, () => {
      console.log("API is running on http://localhost:3000");
    });
  })
  .catch((error) => console.log(error));
