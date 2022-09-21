import { format } from "date-fns";

import { IncrementValueCommand, StashClient } from "@stedi/sdk-client-stash";
import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";
import { PutObjectCommand, PutObjectCommandInput, } from "@stedi/sdk-client-buckets";

import { bucketClient } from "../../../lib/buckets.js";
import { translateJsonToEdi } from "../../../lib/translateV3.js";
import { failedExecution, generateExecutionId, recordNewExecution } from "../../../lib/execution.js";

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
  const functionNamespace = process.env["STEDI_FUNCTION_NAMESPACE"] || "";

  try {
    await recordNewExecution(executionId, event);
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

    if (!controlNumber) return failedExecution(executionId, new Error("Issue generating control number"));
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

    const mapEnvVarName = `${functionNamespace.toUpperCase()}_MAP_ID`;
    const mapId = process.env[mapEnvVarName];
    if (mapId === undefined)
      return failedExecution(executionId, new Error(`Missing ${mapEnvVarName} environment variable`));

    const mapResult = await mappingsClient.send(
      new MapDocumentCommand({
        id: mapId,
        content: {controlNumber, ...event},
      })
    );

    const guideEnvVarName = `${functionNamespace.toUpperCase()}_GUIDE_ID`;
    const guideId = process.env[guideEnvVarName];
    if (guideId === undefined)
      return failedExecution(executionId, new Error(`Missing ${guideEnvVarName} environment variable`));

    const translation = await translateJsonToEdi(mapResult.content, guideId, envelope);

    const putCommandArgs: PutObjectCommandInput = {
      bucketName: process.env.SFTP_BUCKET_NAME,
      key: `trading_partners/${receiverId}/outbound/${controlNumber}.edi`,
      body: translation.output,
    };
    await bucketClient().send(new PutObjectCommand(putCommandArgs));

    return putCommandArgs;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(`unknown error: ${JSON.stringify(e)}`);
    return failedExecution(executionId, error);
  }
};

