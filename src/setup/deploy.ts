import dotenv, { DotenvParseOutput } from "dotenv";

import { compile, packForDeployment } from "../support/compile.js";
import { createFunction, updateFunction } from "../support/functions.js";
import {
  functionNameFromPath,
  getEnabledTransactionSets,
  getExistingResourceIdEnvVars,
  getFunctionPaths,
  getResourcePathsForTransactionSets
} from "../support/utils.js";

dotenv.config({ override: true });

const createOrUpdateFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: {
    [key: string]: string;
  }
) => {
  try {
    await updateFunction(functionName, functionPackage, environmentVariables);
  } catch (e) {
    await createFunction(functionName, functionPackage, environmentVariables);
  }
};

(async () => {
  const functionPaths = getFunctionPaths(process.argv[2]);

  const promises = functionPaths.map(async (fnPath) => {
    const functionName = functionNameFromPath(fnPath);

    console.log(`Deploying ${functionName}`);

    const jsPath = await compile(fnPath);
    const code = await packForDeployment(jsPath);

    try {
      const functionPackage = new Uint8Array(code);
      const baseEnvironmentVariables = dotenv.config().parsed ?? {};

      const resourceIdFiles = getResourcePathsForTransactionSets(getEnabledTransactionSets(), ".resource_ids");
      const resourceIdEnvironmentVariables = resourceIdFiles.reduce((collectedEnvVars: DotenvParseOutput, resourceIdFile) => {
        const resourceEnvVars = getExistingResourceIdEnvVars(resourceIdFile);
        if (!resourceEnvVars) {
          console.error(`Resource ID env vars not found in expected path: ${resourceIdFile}`);
          process.exit (-1);
        }

        return {
          ...collectedEnvVars,
          ...resourceEnvVars,
        }
      }, {});

      const environmentVariables = { ...baseEnvironmentVariables, ...resourceIdEnvironmentVariables };

      environmentVariables["NODE_OPTIONS"] = "--enable-source-maps";
      environmentVariables["STEDI_FUNCTION_NAME"] = functionName;

      const result = await createOrUpdateFunction(
        functionName,
        functionPackage,
        environmentVariables
      );

      console.log(`Done ${functionName}`);

      return result;
    } catch (e) {
      console.error(`Could not update deploy ${functionName}. Error ${e}`);
    }
  });

  await Promise.all(promises);

  console.log(`Deploy completed at: ${new Date().toLocaleString()}`);
})();
