import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import {
  CreateMappingCommand,
  MappingsClient,
} from "@stedi/sdk-client-mappings";

import { getMapPaths, fixtureNamespaceFromPath } from "../support/utils.js";

dotenv.config({ override: true });

(async () => {
  const mappingsClient = new MappingsClient({
    region: "us-east-1",
    endpoint: "https://mappings.us.stedi.com/2021-06-01",
    apiKey: process.env.STEDI_API_KEY,
  });

  const mapPaths = getMapPaths(process.argv[2]);

  const promises = mapPaths.map(async (mapPath) => {
    const mapName = fixtureNamespaceFromPath(mapPath);

    console.log(`Creating map: ${mapName}`);

    const map = fs.readFileSync(
      path.join(process.cwd(), mapPath),
      "utf8"
    );


    const newMap = await mappingsClient.send(
      new CreateMappingCommand({
        ...JSON.parse(map),
      })
    );

    console.log(`${mapName.toUpperCase()}_MAP_ID=${newMap.id}`);
  });

  await Promise.all(promises);
})();
