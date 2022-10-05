import { format } from "date-fns";

import { IncrementValueCommand, StashClient } from "@stedi/sdk-client-stash";
import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";
import { PutObjectCommand, PutObjectCommandInput, } from "@stedi/sdk-client-buckets";

import { bucketClient } from "../../../lib/buckets.js";
import { translateJsonToEdi } from "../../../lib/translateV3.js";
import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { getEnvVarNameForResource, requiredEnvVar } from "../../../lib/environment.js";

const sdkClientProps = {
  apiKey: requiredEnvVar("STEDI_API_KEY"),
  region: "us",
};

const stashClient = new StashClient(sdkClientProps);
const mappingsClient = new MappingsClient(sdkClientProps);

// buckets client is shared across handler and execution tracking logic
const bucketsClient = bucketClient();

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);

  try {
    await recordNewExecution(executionId, event);

    if (!event.transactionSet) {
      return failedExecution(executionId, new Error("Required property `transactionSet` missing from input event"));
    }

    // Fail fast if required env vars are missing
    const guideEnvVarName = getEnvVarNameForResource("guide", event.transactionSet);
    const mappingEnvVarName = getEnvVarNameForResource("mapping", event.transactionSet);
    const guideId = requiredEnvVar(guideEnvVarName);
    const mappingId = requiredEnvVar(mappingEnvVarName);

    console.log("starting", { input: event, executionId });

    const functionalIdentifierCode = "OW";
    const senderId = "AMERCHANT";
    const receiverId = "ANOTHERMERCH";
    const usageIndicatorCode = "T";

    const documentDate = new Date();

    // Generate control number for sender/receiver pair
    let { value: controlNumber } = await stashClient.send(
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

    // Configure envelope data (interchange control header and functional group header) to combine with mapping result
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

    // Execute mapping to transform API JSON input to Guide schema-based JSON
    const mapResult = await mappingsClient.send(
      new MapDocumentCommand({
        id: mappingId,
        content: { controlNumber, ...event },
      })
    );

    // Translate the Guide schema-based JSON to X12 EDI
    const translation = await translateJsonToEdi(mapResult.content, guideId, envelope);

    // Save generated X12 EDI file to SFTP-accessible Bucket
    const putCommandArgs: PutObjectCommandInput = {
      bucketName: process.env.SFTP_BUCKET_NAME,
      key: `trading_partners/${receiverId}/outbound/${controlNumber}.edi`,
      body: translation.output,
    };
    await bucketsClient.send(new PutObjectCommand(putCommandArgs));

    await markExecutionAsSuccessful(executionId);

    return {
      statusCode: 200,
      ...putCommandArgs
    };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(`unknown error: ${JSON.stringify(e)}`);
    return failedExecution(executionId, error);
  }
};
