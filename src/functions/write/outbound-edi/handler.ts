import { format } from "date-fns";

import { IncrementValueCommand, StashClient } from "@stedi/sdk-client-stash";
import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";
import { PutObjectCommand, PutObjectCommandInput, } from "@stedi/sdk-client-buckets";

import { bucketClient } from "../../../lib/buckets.js";
import { translateJsonToEdi } from "../../../lib/translateV3.js";
import { failedExecution, generateExecutionId, recordNewExecution } from "../../../lib/execution.js";
import { requiredEnvVar } from "../../../lib/environment.js";

const baseClientProps = {region: "us"};

const stashClient = new StashClient({
  ...baseClientProps,
  apiKey: process.env.STEDI_API_KEY,
});

const mappingsClient = new MappingsClient({
  ...baseClientProps,
  apiKey: process.env.STEDI_API_KEY,
});

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);

  try {
    await recordNewExecution(executionId, event);

    if (!event.transactionSet) {
      return failedExecution(executionId, new Error("Required property `transactionSet` missing from input event"));
    }

    const transactionSetEnvVarPrefix = event.transactionSet.toUpperCase().replace("-", "_");

    // Fail fast if required env vars are missing
    const guideEnvVarName = `${transactionSetEnvVarPrefix}_GUIDE_ID`;
    const mapEnvVarName = `${transactionSetEnvVarPrefix}_MAPPING_ID`;
    const guideId = requiredEnvVar(guideEnvVarName);
    const mapId = requiredEnvVar(mapEnvVarName);

    console.log("starting", {input: event, executionId});

    const functionalIdentifierCode = "OW";
    const senderId = "AMERCHANT";
    const receiverId = "ANOTHERMERCH";
    const usageIndicatorCode = "T";

    const documentDate = new Date();

    let {value: controlNumber} = await stashClient.send(
      new IncrementValueCommand({
        keyspaceName: "outbound-control-numbers",
        key: `${usageIndicatorCode}-${functionalIdentifierCode}-${senderId}-${receiverId}`,
        amount: 1,
      })
    );

    if (!controlNumber) {
      return failedExecution(executionId, new Error("Issue generating control number"));
    }

    controlNumber = controlNumber.toString().padStart(9, "0");

    const envelope = {
      interchangeHeader: {
        senderQualifier: "ZZ",
        senderId,
        receiverQualifier: "14",
        receiverId,
        date: format(documentDate, "yyyy-MM-dd"),
        time: format(documentDate, "HH:mm"),
        controlNumber,
        usageIndicatorCode,
      },
      groupHeader: {
        functionalIdentifierCode,
        applicationSenderCode: "WRITEDEMO",
        applicationReceiverCode: "072271711TMS",
        date: format(documentDate, "yyyy-MM-dd"),
        time: format(documentDate, "HH:mm:ss"),
        controlNumber,
      },
    };

    const mapResult = await mappingsClient.send(
      new MapDocumentCommand({
        id: mapId,
        content: {controlNumber, ...event},
      })
    );

    const translation = await translateJsonToEdi(mapResult.content, guideId, envelope);

    const putCommandArgs: PutObjectCommandInput = {
      bucketName: process.env.SFTP_BUCKET_NAME,
      key: `trading_partners/${receiverId}/outbound/${controlNumber}.edi`,
      body: translation.output,
    };
    await bucketClient().send(new PutObjectCommand(putCommandArgs));

    return {
      statusCode: 200,
      ...putCommandArgs
    };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(`unknown error: ${JSON.stringify(e)}`);
    return failedExecution(executionId, error);
  }
};
