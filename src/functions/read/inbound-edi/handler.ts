import fetch from "node-fetch";
import consumers from 'stream/consumers';
import { Readable } from "stream";

import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";
import { DeleteObjectCommand, GetObjectCommand } from "@stedi/sdk-client-buckets";

import { translateEdiToJson } from "../../../lib/translateV3.js";
import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution
} from "../../../lib/execution.js";
import { Convert, Record as BucketNotificationRecord } from "../../../lib/types/BucketNotificationEvent.js";
import { bucketClient } from "../../../lib/buckets.js";
import { FilteredKey, GroupedEventKeys, KeyToProcess, ReadInboundEdiResults } from "./types.js";
import { requiredEnvVar } from "../../../lib/environment.js";

const baseClientProps = {region: "us"};

const mappingsClient = new MappingsClient({
  ...baseClientProps,
  apiKey: process.env.STEDI_API_KEY,
});

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);

  try {
    await recordNewExecution(executionId, event);
    const bucketNotificationEvent = Convert.toBucketNotificationEvent(JSON.stringify(event));

    // Fail fast if required env vars are missing
    const functionNamespace = requiredEnvVar("STEDI_FUNCTION_NAMESPACE");

    const guideEnvVarName = `${functionNamespace.toUpperCase()}_GUIDE_ID`;
    const guideId = requiredEnvVar(guideEnvVarName);

    const mapEnvVarName = `${functionNamespace.toUpperCase()}_MAP_ID`;
    const mapId = requiredEnvVar(mapEnvVarName);

    const destinationWebhookUrl = requiredEnvVar("READ_DESTINATION_WEBHOOK_URL");

    const groupedEventKeys = groupEventKeys(bucketNotificationEvent.Records);

    const results: ReadInboundEdiResults = {
      filteredKeys: groupedEventKeys.filteredKeys,
      processingErrors: [],
      processedKeys: [],
    }

    for await (const keyToProcess of groupedEventKeys.keysToProcess) {
      const getObjectResponse = await bucketClient().send(new GetObjectCommand(keyToProcess));
      const fileContents = await consumers.text(getObjectResponse.body as Readable);
      const translation = await translateEdiToJson(fileContents, guideId);

      // limit support to one transaction set for the demo... could easily be extended to loop through
      if (translation.output.transactionSets.length !== 1) {
        results.processingErrors.push({
          key: keyToProcess.key,
          error: new Error(`expected exactly 1 transaction set in input, found ${translation.transactionSets.length}`),
        });

        continue;
      }

      const {envelope, transactionSets} = translation.output;

      // parse out only the desired content from the interchange/group headers to include in mapping input alongside guide-based JSON
      const {interchangeHeader, groupHeader} = envelope;
      const {receiverId, senderId, controlNumber: interchangeControlNumber} = interchangeHeader;
      const {applicationSenderCode, applicationReceiverCode, controlNumber: groupControlNumber} = groupHeader;

      const mappingContent = {
        envelopeData: {
          interchangeHeader: {
            senderId,
            receiverId,
            interchangeControlNumber,
          },
          groupHeader: {
            applicationSenderCode,
            applicationReceiverCode,
            groupControlNumber,
          }
        },
        ...transactionSets[0],
      }

      const mapResult = await mappingsClient.send(
        new MapDocumentCommand({
          id: mapId,
          content: mappingContent,
        })
      );

      if (!mapResult.content) {
        results.processingErrors.push({
          key: keyToProcess.key,
          error: new Error("Failed to map document. No content returned"),
        });

        continue;
      }

      await fetch(
        destinationWebhookUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mapResult.content),
        }
      );

      // Delete the processed file (could also move to a `processed` directory if desired)
      await bucketClient().send(new DeleteObjectCommand(keyToProcess));
      results.processedKeys.push(keyToProcess.key);
    }

    await markExecutionAsSuccessful(executionId);

    // For additional visibility into the results of each function execution, the
    // `results` could also be sent to the webhook (or some other destination)
    console.log(JSON.stringify(results));

    return results;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(`unknown error: ${JSON.stringify(e)}`);
    return failedExecution(executionId, error);
  }
};

const groupEventKeys = (records: BucketNotificationRecord[]): GroupedEventKeys => {
  const filteredKeys: FilteredKey[] = [];
  const keysToProcess = records.reduce((collectedKeys: KeyToProcess[], record) => {
    const eventKey = record.s3.object.key;

    if (eventKey.endsWith("/")) {
      filteredKeys.push({
        key: eventKey,
        reason: "key represents a folder",
      });
      return collectedKeys;
    }
    const splitKey = eventKey.split("/");
    if (splitKey.length < 2 || splitKey[splitKey.length - 2] !== "inbound") {
      filteredKeys.push({
        key: eventKey,
        reason: "key does not match an item in an `inbound` directory",
      });
      return collectedKeys;
    }

    return collectedKeys.concat({
      bucketName: record.s3.bucket.name,
      key: eventKey,
    });
  }, []);

  return {
    filteredKeys,
    keysToProcess,
  }
}