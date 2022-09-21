import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { CreateGuideInput } from "@stedi/sdk-client-guides";

import { createGuide, publishGuide } from "../support/guide.js";
import { fixtureNamespaceFromPath, getGuidePaths } from "../support/utils.js";

dotenv.config({ override: true });

(async () => {
  const guidePaths = getGuidePaths(process.argv[2]);

  const promises = guidePaths.map(async (guidePath) => {
    const guideName = fixtureNamespaceFromPath(guidePath);

    console.log(`Creating guide: ${guideName}`);

    const rawGuide = fs.readFileSync(
      path.join(process.cwd(), guidePath),
      "utf8"
    );

    const guide = JSON.parse(rawGuide) as CreateGuideInput;

    const guideId = await createGuide(guide);
    await publishGuide(guideId);

    console.log(`${guideName.toUpperCase()}_GUIDE_ID=${guideId.split("_")[1]}`);
  });

  await Promise.all(promises);
})();
