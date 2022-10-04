import hash from "object-hash";
import { TextEncoder } from "util";
import { ErrorObject, serializeError } from "serialize-error";
import { bucketClient } from "./buckets";
import { DeleteObjectCommand, PutObjectCommand, } from "@stedi/sdk-client-buckets";

const bucketName = process.env["EXECUTIONS_BUCKET_NAME"];

export type FailureRecord = { bucketName?: string, key: string };

export const recordNewExecution = async (executionId: string, input: any) => {
  const result = await bucketClient().send(
    new PutObjectCommand({
      bucketName,
      key: `functions/${functionName()}/${executionId}/input.json`,
      body: new TextEncoder().encode(JSON.stringify(input)),
    })
  );
  if (result)
    console.log({ action: "recordNewExecution", executionId, result });
};

export const markExecutionAsSuccessful = async (executionId: string) => {
  let inputResult = await bucketClient().send(
    new DeleteObjectCommand({
      bucketName,
      key: `functions/${functionName()}/${executionId}/input.json`,
    })
  );

  if (inputResult)
    console.log({
      action: "markExecutionAsSuccessful",
      executionId,
      inputResult,
    });

  // async invokes automatically retries on failure, so
  // we should attempt to cleanup any leftover failure results
  // as this might be a later retry invoke
  const failureResult = await bucketClient().send(
    new DeleteObjectCommand({
      bucketName,
      key: `functions/${functionName()}/${executionId}/failure.json`,
    })
  );

  if (failureResult)
    console.log({
      action: "markExecutionAsSuccessful",
      executionId,
      failureResult,
    });
  return { inputResult, failureResult };
};

export const failedExecution = async (
  executionId: string,
  error: Error
): Promise<{ statusCode: number, message: string, failureRecord: FailureRecord, error: ErrorObject }> => {
  const rawError = serializeError(error)
  const failureRecord = await markExecutionAsFailed(executionId, rawError);
  const statusCode = (error as any)?.["$metadata"]?.httpStatusCode || 500;
  return { statusCode, message: "execution failed", failureRecord, error: rawError }
}

const markExecutionAsFailed = async (
  executionId: string,
  error: ErrorObject
): Promise<FailureRecord> => {
  const key = `functions/${functionName()}/${executionId}/failure.json`;
  const result = await bucketClient().send(
    new PutObjectCommand({
      bucketName,
      key,
      body: new TextEncoder().encode(JSON.stringify(error)),
    })
  );

  if (result)
    console.log({ action: "markExecutionAsFailed", executionId, result });

  return { bucketName, key };
};

export const generateExecutionId = (event: any) => hash({
  functionName: functionName(),
  event,
});

export const functionName = () => process.env["STEDI_FUNCTION_NAME"];