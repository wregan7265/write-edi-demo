# Write EDI Demo
The main orchestration point of this demo is a Stedi function called `write-outbound-edi`, which is written in [TypeScript](./src/functions/write/outbound-edi/handler.ts). For this workload, the function is the entry point and expected to be called along with a JSON payload that respresents the source data that needs to be converted into the X12 EDI 850.

As the illustration below shows, the `write-outbound-edi` function performs several steps:

1. Accepts a JSON payload of the source data.

2. Calls [Stash](https://www.stedi.com/docs/stash) to generate a control number for the EDI document.

3. Passes the incoming source JSON to [Mappings](https://www.stedi.com/docs/mappings) using a predefined Map. The Map converts the source data to a predefined Stedi Guide (which is a JSON Schema).

4. Combines the mapped result, control number & guide id before calling the EDI Translate API.

5. The EDI Translate API retrieves the guide, and generates the X12 EDI document validating the result.

6. The function finally saves the EDI string as a file in a Bucket (for later retrieval via SFTP).

![write-edi function flow](../../../assets/write-edi.jpg)

## Invoking the function

Once deployed, you may access the Function Web UI and perform the following steps.

1. In the [Functions List view](https://www.stedi.com/terminal/functions) you should see a function labelled `write-edi`, click on it's name to view its details.

2. Click the `Edit environment variables` link and confirm you see the variables as defined in your `.env` file.

3. Click the `Edit execution payload` link, pasting the [contents of this file](../../fixtures/write/input.json) as the input and click save.

4. Hit the `Execute` button, if successful the `Output` should look as follows:

```json
{
   "bucketName": "4c22f54a-9ecf-41c8-b404-6a1f20674953-sftp",
   "key": "trading_partners/ANOTHERMERCH/outbound/000000001.edi",
   "body": "ISA*00*          *00*          *ZZ*AMERCHANT      *14*ANOTHERMERCH   *220915*0218*U*00501*000000001*0*T*>~GS*OW*WRITEDEMO*072271711TMS*20220915*021828*000000001*X*005010~ST*850*000000001~BEG*00*DS*365465413**20220830~REF*CO*ACME-4567~REF*ZZ*Thank you for your business~PER*OC*Marvin Acme*TE*973-555-1212*EM*marvin@acme.com~TD5****ZZ*FHD~N1*ST*Wile E Coyote*92*123~N3*111 Canyon Court~N4*Phoenix*AZ*85001*US~PO1*item-1*0008*EA*400**VC*VND1234567*SK*ACM/8900-400~PID*F****400 pound anvil~PO1*item-2*0004*EA*125**VC*VND000111222*SK*ACM/1100-001~PID*F****Detonator~CTT*2~AMT*TT*3700~SE*16*000000001~GE*1*000000001~IEA*1*000000001~"
}
```

5. You can view the file using the [Buckets Web View](https://www.stedi.com/app/buckets).

6. You may also connect using your preferred SFTP client and the user credentials provisioned earlier to retrieve the file.

7. You can also view the other resources that were created during setup in the UIs for the associated products:
    - [Guides Web UI](https://www.stedi.com/app/guides)
    - [Mappings Web UI](https://www.stedi.com/app/mappings)
    - [Stash Web UI](https://www.stedi.com/app/stash)
