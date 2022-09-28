import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { CreateGuideInput, ResourceConflictException } from "@stedi/sdk-client-guides";

import { createGuide, publishGuide } from "../support/guide.js";
import {
  resourceNamespaceFromPath,
  getResourcePathsForTransactionSets,
  writeResourceIdsFile,
  getExistingResourceIdEnvVars,
  printResourceSummary,
  ResourceDetails,
  getResourceIdFilePath,
  getEnabledTransactionSets
} from "../support/utils.js";

dotenv.config({override: true});

(async () => {
  const guidePaths = getResourcePathsForTransactionSets(getEnabledTransactionSets(), "guide.json");

  let createdGuides: ResourceDetails[] = [];
  const promises = guidePaths.map(async (guidePath) => {
    const guideName = resourceNamespaceFromPath(guidePath);

    console.log(`Creating guide: ${guideName}`);

    const rawGuide = fs.readFileSync(
      path.join(process.cwd(), guidePath),
      "utf8"
    );

    const guide = JSON.parse(rawGuide) as CreateGuideInput;

    let guideId;
    try {
      guideId = await createGuide(guide);
      await publishGuide(guideId);
    } catch (e) {
      if (e instanceof ResourceConflictException) {
        console.log(`Guide already exists (skipping): ${guideName}`);
        return
      }

      // Exit with error code for all other errors
      console.log(`Error creating guide: ${JSON.stringify(e)}`);
      process.exit(-1);
    }

    const guideDir = path.dirname(guidePath);
    const guideEnvVarName = `${guideName.toUpperCase().replace("-", "_")}_GUIDE_ID`;

    const envVars = getExistingResourceIdEnvVars(getResourceIdFilePath(guideDir)) || {};
    envVars[guideEnvVarName] = guideId.split("_")[1];
    writeResourceIdsFile(envVars, guideDir);

    createdGuides.push({ name: guideName, id: guideId });
  });

  await Promise.all(promises);
  printResourceSummary("guide", createdGuides);
})();
