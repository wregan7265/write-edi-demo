import { format } from "date-fns";
import { serializeError } from "serialize-error";

import { IncrementValueCommand, StashClient } from "@stedi/sdk-client-stash";
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
import { DEFAULT_SDK_CLIENT_PROPS } from "../../../lib/constants.js";

const stashClient = new StashClient(DEFAULT_SDK_CLIENT_PROPS);

// Buckets client is shared across handler and execution tracking logic
const bucketsClient = bucketClient();

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);
  console.log("starting", JSON.stringify({ input: event, executionId }));

  try {
    await recordNewExecution(executionId, event);

    const transactionSetIdentifier = getTransactionSetIdentifierForInput(event.ediMetadata);

    // Fail fast if required env vars are missing
    const guideEnvVarName = getEnvVarNameForResource("guide", transactionSetIdentifier);
    const guideId = requiredEnvVar(guideEnvVarName);

    // TODO: replace hardcoded values -- possibly incorporate into incoming event schema?
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
    console.log(`generated control number: ${controlNumber}`);

    // TODO: replace hardcoded qualifiers and codes in envelope data
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

    // Translate the Guide schema-based JSON to X12 EDI
    const translation = await translateJsonToEdi({ transactionSets: event.transactionSets }, guideId, envelope);

    // Save generated X12 EDI file to SFTP-accessible Bucket
    const putCommandArgs: PutObjectCommandInput = {
      bucketName: process.env.SFTP_BUCKET_NAME,
      key: `trading_partners/${receiverId}/outbound/${controlNumber}.edi`,
      body: translation,
    };
    await bucketsClient.send(new PutObjectCommand(putCommandArgs));

    await markExecutionAsSuccessful(executionId);

    return {
      statusCode: 200,
      ...putCommandArgs
    };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(`unknown error: ${serializeError(e)}`);
    return failedExecution(executionId, error);
  }
};

// Use ediMetadata input property to construct the transaction set identifier using the convention used in this demo
const getTransactionSetIdentifierForInput = (ediMetadata: any): string => {
  if (!ediMetadata?.release || !ediMetadata?.code) {
    throw new Error("Invalid input: `ediMetadata: { release: string; code: string; }` property is required");
  }

  return `X12-${ediMetadata.release}-${ediMetadata.code}`;
};
