# Identity Reconciliation

## Introduction

This project aims to solve the challenge of identity reconciliation for customers making purchases with different contact information on an e-commerce platform. The platform can identify and track customer identities across multiple purchases, even if different emails and phone numbers are used.

## Features

- Identify and consolidate customer contact information.
- Link multiple contacts to a primary contact.
- Ensure a personalized customer experience by tracking loyal customers.

## Database Schema

The contact information is stored in a relational database table named `Contact`:

```sql
{
    id Int,
    phoneNumber String?,
    email String?,
    linkedId Int?, // the ID of another Contact linked to this one
    linkPrecedence "secondary" | "primary", // "primary" if it's the first Contact
    createdAt DateTime,
    updatedAt DateTime,
    deletedAt DateTime?
}
```

## Endpoint

### `/identify`

#### Request

The `/identify` endpoint receives HTTP POST requests with a JSON body containing either or both of the following fields:

```json
{
    "email": "string",
    "phoneNumber": "number"
}
```

#### Response

The endpoint returns an HTTP 200 response with a JSON payload containing the consolidated contact information:

```json
{
    "contact": {
        "primaryContactId": "number",
        "emails": ["string"], // first element being email of primary contact
        "phoneNumbers": ["string"], // first element being phoneNumber of primary contact
        "secondaryContactIds": ["number"] // Array of all Contact IDs that are "secondary"
    }
}
```

## Examples

### Request

```json
{
    "email": "mcfly@hillvalley.edu",
    "phoneNumber": "123456"
}
```

### Response

```json
{
    "contact": {
        "primaryContactId": 1,
        "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
        "phoneNumbers": ["123456"],
        "secondaryContactIds": [23]
    }
}
```

## Usage Scenarios

### Scenario 1: No Existing Contacts

If there are no existing contacts matching the incoming request, a new `Contact` row is created with `linkPrecedence="primary"`.

### Scenario 2: Existing Contact with New Information

If an incoming request has either a phone number or email common to an existing contact but contains new information, a new `secondary` Contact row is created and linked to the primary contact.

### Scenario 3: Turning Primary Contacts into Secondary

If a new contact links two existing contacts, one of them will become a `secondary` contact. The database will update accordingly.

## Technology Stack

- **Database**: My SQL
- **Backend Framework**: Node.js with TypeScript

## Deployment

The application is hosted online, and the endpoint can be accessed at: `https://identity-reconciliation-wjcz.onrender.com/identify` [POST Request]

## How to Run

1. Clone the repository from GitHub.
2. Install dependencies using `npm install`.
3. Set up your database and configure the connection settings.
4. Run the application using `npm start`.
