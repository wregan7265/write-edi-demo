# Stedi EDI Demos

This repo contains an end-to-end demos for reading and writing EDI X12 documents:
* `write` [EDI 850](https://www.stedi.com/edi/x12/transaction-set/850) X12 documents from a sample [JSON API input](src/fixtures/write/input.json).
* `read` [EDI 855](https://www.stedi.com/edi/x12/transaction-set/855) X12 documents to create a JSON payload used to call a webhook

These implementations demonstrate one possible way to interact with Stedi's APIs to achieve a typical EDI read or write workload; your implementation may include some or all of these products depending on your particular systems and requirements.

## Prerequisites

1. A [working nodejs environment](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) is required before proceeding with these steps _(note: `npm` version must be 7.x or greater)_.

2. After [cloning](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) this git repository locally, change into the repo directory and install the dependencies:

   ```bash
     npm install
   ```

3. This project uses `dotenv` to manage the environmental variables required, you must create a `.env` file in the root directory of this repo adding the following:

   ```
   # Your Stedi API Key - used to deploy the function and internally to interact with product apis.
   STEDI_API_KEY=<REPLACE_ME>
   ```

   **NOTE:** You can generate an [API Key here](https://www.stedi.com/app/settings/api-keys).

4. Create the EDI Guides by running:

   ```bash
     # optionally specify a namespace of `read` or `write` 
     # to only create the guide for the corresponding demo
     npm run create-guides [read|write]
   ```

   This will output the Guide ID environment variable entries that will be needed to add to the `.env` file in a later step

5. Create the Maps by running:

   ```bash
     # optionally specify a namespace of `read` or `write` 
     # to only create the map for the corresponding demo
     npm run create-maps [read|write]
   ```

   This will output the Map ID environment variable entries that will be needed to add to the `.env` file in a later step

6. [Optional -- Required for Write EDI] Create the Stash Keyspace to store control numbers:

   ```bash
     npm run create-keyspace
   ```

7. Configure the Buckets (one for SFTP access and one for tracking function executions):

   ```bash
     npm run configure-buckets
   ```

   This will return the sftp Bucket name, please note this as it will be required in a later step.

8. [Optional -- Required for Read EDI] Determine the destination webhook URL to send the output data to. The [Read EDI](./src/functions/read/README.md) demo processes inbound X12 EDI 855 input, transforms it into JSON, and sends the data to a webhook. You can easily set up a free webhook for the demo and test purposes by visiting [webhook.site](https://webhook.site/). This site will automatically generate an endpoint (for example: `https://webhook.site/<some-unique-id>`) that will capture all data that is sent to it, for up to 500 requests.

9. [Optional] Provision an SFTP user, by visiting the [SFTP Web UI](https://www.stedi.com/app/sftp), be sure to set its `Home directory` to `/trading_partners/ANOTHERMERCH` and record the password (it will not be shown again).

## Setup & Deployment

This repo includes a basic deployment script to bundle and deploy the included functions to Stedi. To deploy you must complete the following steps:

1. Using the IDs generated above, edit the `.env` file and **ADD** the following, using the values gathered above where indicated:

   ```
   # The IDs of the Guides - see above
   READ_GUIDE_ID=<YOUR_READ_GUIDE_ID>>
   WRITE_GUIDE_ID=<YOUR_WRITE_GUIDE_ID>

   # The IDs of the Maps - see above
   READ_MAP_ID=<YOUR_READ_MAP_ID>
   WRITE_MAP_ID=<YOUR_WRITE_MAP_ID>
   
   # The names of the SFTP and Executions Buckets - see above
   EXECUTIONS_BUCKET_NAME=<YOUR+EXECUTIONS_BUCKET>
   SFTP_BUCKET_NAME=<YOUR_SFTP_BUCKET>
   
   # Optional -- required for Read EDI demo - see above
   # example: READ_DESTINATION_WEBHOOK_URL=https://webhook.site/<unique-id-for-your-webhook>
   READ_DESTINATION_WEBHOOK_URL=<YOUR_WEBHOOK_URL_HERE>
   ```

2. To deploy the functions:

   ```bash
   # optionally specify a namespace of `read` or `write` 
   # to only create the function for the corresponding demo
   npm run deploy [read|write]
   ```

   This should produce the following output:

   ```
   > stedi-write-edi-demo@1.1.0 deploy
   > ts-node ./src/setup/deploy.ts

   Deploying read-inbound-edi
   Deploying write-outbound-edi
   Done read-inbound-edi
   Done write-outbound-edi
   Deploy completed at: 9/14/2022, 08:48:43 PM
   ```
   
3. [Optional -- Required for Read EDI] Enable bucket notifications for the SFTP Bucket to invoke the `read-inbound-edi` function when files are written to the bucket.

   ```bash
     npm run enable-notifications
   ```

#### TODO: add details about execution tracking logic

## Demos

Now it's time for the fun part, running the demos! Refer to the README for each demo to so:

1. [Write EDI Demo](./src/functions/write/README.md)

2. [Read EDI Demo](./src/functions/read/README.md)
