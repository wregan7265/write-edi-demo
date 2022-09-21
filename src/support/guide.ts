import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import {
  CreateGuideCommand,
  CreateGuideInput,
  GetGuideCommand,
  GuidesClient,
  GuidesClientConfig,
  GuideVisibility,
  PublishGuideCommand
} from "@stedi/sdk-client-guides";
import { GetGuideOutput } from "@stedi/sdk-client-guides/dist-types/models/models_0";

let _guidesClient: GuidesClient;

export const guidesClient = () => {
  if (_guidesClient === undefined) {
    const config: GuidesClientConfig = {
      apiKey: process.env.STEDI_API_KEY,
      endpoint: "https://guides.us.stedi.com/2022-03-09",
      maxAttempts: 5,
      region: "us-east-1",
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
      }),
    };

    _guidesClient = new GuidesClient(config);
  }

  return _guidesClient;
};

export const loadGuide = async (
  guideId?: string
): Promise<GetGuideOutput> => {
  return await guidesClient().send(new GetGuideCommand({ id: guideId }))
};

export const createGuide = async (guide: CreateGuideInput): Promise<string> => {
  const createGuideResponse = await guidesClient().send(new CreateGuideCommand(guide));

  if (!createGuideResponse.id)
    throw new Error("Error creating guide (id not found in response.");

  return createGuideResponse.id;
};

export const publishGuide = async (guideId: string): Promise<any> => {
  return await guidesClient().send(new PublishGuideCommand({
    id: guideId,
    visibility: GuideVisibility.INTERNAL
  }));
};