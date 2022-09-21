import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import {
  EDITranslateClient,
  EDITranslateClientConfig,
  TranslateJsonToX12Command, TranslateJsonToX12CommandOutput, TranslateX12ToJsonCommand
} from "@stedi/sdk-client-edi-translate";

let _translateClient: EDITranslateClient;

export const translateClient = () => {
  if (_translateClient === undefined) {
    const config: EDITranslateClientConfig = {
      apiKey: process.env.STEDI_API_KEY,
      endpoint: "https://edi-translate.us.stedi.com/2022-01-01",
      maxAttempts: 5,
      region: "us-east-1",
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
      }),
    };

    _translateClient = new EDITranslateClient(config);
  }

  return _translateClient;
};

export const translateJsonToEdi = async (
  input: any,
  guideId: string,
  envelope: any
): Promise<TranslateJsonToX12CommandOutput> => {
  return await translateClient().send(new TranslateJsonToX12Command({
    guideId,
    input,
    envelope
  }));
};

export const translateEdiToJson = async (
  input: string,
  guideId: string,
): Promise<any> => {
  return await translateClient().send(new TranslateX12ToJsonCommand({
    input,
    guideId,
  }));
};
