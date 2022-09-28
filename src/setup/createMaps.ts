import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { CreateMappingCommand, MappingsClient } from "@stedi/sdk-client-mappings";

import {
  getEnabledTransactionSets,
  getExistingResourceIdEnvVars,
  getResourceIdFilePath,
  getResourcePathsForTransactionSets,
  printResourceSummary,
  ResourceDetails,
  resourceNamespaceFromPath,
  writeResourceIdsFile
} from "../support/utils.js";

dotenv.config({ override: true });

(async () => {
  const mappingsClient = new MappingsClient({
    region: "us-east-1",
    endpoint: "https://mappings.us.stedi.com/2021-06-01",
    apiKey: process.env.STEDI_API_KEY,
  });

  const mapPaths = getResourcePathsForTransactionSets(getEnabledTransactionSets(), "map.json");

  const createdMappings: ResourceDetails[] = [];
  const promises = mapPaths.map(async (mapPath) => {
    const mapName = resourceNamespaceFromPath(mapPath);

    console.log(`Creating map: ${mapName}`);

    const map = fs.readFileSync(
      path.join(process.cwd(), mapPath),
      "utf8"
    );

    let mapId;
    try {
      const newMap = await mappingsClient.send(
        new CreateMappingCommand({
          ...JSON.parse(map),
        })
      );

      mapId = newMap.id;
    } catch (e) {
      const error = e as any;
      // workaround until Mappings SDK returns the necessary error metadata
      // if (e instanceof ResourceConflictException) {
      if (error.code === "entity_already_exists") {
        console.log(`Map already exists (skipping): ${mapName}`);
        return;
      }

      console.log(`Error creating map: ${JSON.stringify(e)}`);
      process.exit(-1);
    }

    // Exit with error code for all other errors
    if (!mapId) {
      console.error("Error creating map; no id found in response");
      process.exit(-1);
    }

    const mapDir = path.dirname(mapPath);
    const mapEnvVarName =`${mapName.toUpperCase().replace("-", "_")}_MAP_ID`;

    const envVars = getExistingResourceIdEnvVars(getResourceIdFilePath(mapDir)) || {};
    envVars[mapEnvVarName] = mapId;
    writeResourceIdsFile(envVars, mapDir);

    createdMappings.push({ name: mapName, id: mapId });
  }, []);

  await Promise.all(promises);
  printResourceSummary("mapping", createdMappings);
})();
