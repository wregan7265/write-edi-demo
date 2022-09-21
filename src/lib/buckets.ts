import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { BucketsClient, BucketsClientConfig } from "@stedi/sdk-client-buckets";

let _bucketClient: BucketsClient;

export const bucketClient = () => {
  if (_bucketClient === undefined) {
    const config: BucketsClientConfig = {
      maxAttempts: 5,
      region: "us-east-1",
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
      }),
    };

    // additional config needed when running function code locally.
    if (!process.env.LAMBDA_TASK_ROOT) {
      config.endpoint = `https://buckets.cloud.us.stedi.com/2022-05-05`;
      config.apiKey = process.env.STEDI_API_KEY ?? "";
    }
    _bucketClient = new BucketsClient(config);
  }

  return _bucketClient;
};
