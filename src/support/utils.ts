import fs from "fs";
import dotenv from "dotenv";
import { requiredEnvVar } from "../lib/environment.js";

const DEFAULT_RESOURCE_ID_BASE_PATH = "./src/resources";
const DEFAULT_RESOURCE_ID_FILE_NAME = ".resource_ids";

type ResourceFile = {
  basePath: string;
  fileName?: string;
};

type ResourceType = "mapping" | "guide";

export type ResourceDetails = {
  name: string;
  id: string;
};

export const functionNameFromPath = (fnPath: string): string => {
  // get function name excluding extension
  // path-a/path-b/path-never-ends/nice/function/handler.ts
  // => nice-function
  return fnPath.split("/").slice(-3, -1).join("-");
};

export const resourceNamespaceFromPath = (path: string): string => {
  // path-a/path-b/path-never-ends/nice/resources/X12-850/map.json
  // => read
  return path.split('/').slice(-2, -1)[0];
}

export const getFunctionPaths = (pathMatch?: string) => {
  const functionsRoot = "./src/functions";
  const namespaces = fs.readdirSync(functionsRoot);

  const allFunctionPaths = namespaces.reduce(
    (paths: string[], namespace) => {
    if (fs.lstatSync(`${functionsRoot}/${namespace}`).isFile()) return paths;

    return paths.concat(getAssetPaths({ basePath: `${functionsRoot}/${namespace}`, fileName: "handler.ts" }));
  }, []);

  return filterPaths(allFunctionPaths, pathMatch);
};

export const getEnabledTransactionSets = (): string[] => {
  const enabledTransactionSetsList = requiredEnvVar("ENABLED_TRANSACTION_SETS");
  return enabledTransactionSetsList.split(",");
}

// gets a set of resource paths for each transaction set in the list
// for example, all map.json, guide.json, or .resource_ids files across each transaction set
export const getResourcePathsForTransactionSets = (
  transactionSets: string[],
  fileName: string,
  basePath = DEFAULT_RESOURCE_ID_BASE_PATH)  => {
  const allResourcePaths = getAssetPaths({ basePath, fileName });
  return transactionSets.flatMap((txnSet) => filterPaths(allResourcePaths, txnSet));
}

// generic asset path retrieval (internal helper used for getting function
// paths as well as resource paths for transaction sets
const getAssetPaths = (resourceFile: Required<ResourceFile>): string[] => {
  const assets = fs.readdirSync(resourceFile.basePath);

  return assets.reduce((collectedAssets: string[], assetName) => {
      if (fs.lstatSync(`${resourceFile.basePath}/${assetName}`).isFile() ||
        !fs.existsSync(`${resourceFile.basePath}/${assetName}/${resourceFile.fileName}`)) {
        return collectedAssets;
      }

      return collectedAssets.concat(`${resourceFile.basePath}/${assetName}/${resourceFile.fileName}`);
  }, []);
}

// helper function to filter out paths that don't include the `pathMatch` string, and to check for `no match`
const filterPaths = (paths: string[], pathMatch?: string): string[] => {
  if (pathMatch) paths = paths.filter((path) => path.includes(`/${pathMatch}`));

  if (paths.length === 0) {
    console.error(`No matching assets found. (path filter: ${pathMatch})`);
    process.exit(1);
  }

  return paths;
}

// read environment variable file and parse contents
export const getExistingResourceIdEnvVars = (resourceFilePath: string): dotenv.DotenvParseOutput | undefined => {
  if (fs.existsSync(resourceFilePath)) {
    const contents = fs.readFileSync(resourceFilePath);
    return dotenv.parse(contents);
  }

  return undefined;
}

export const writeResourceIdsFile = (envVars: Record<string, string>, resourceBasePath: string) => {
  const resourceFilePath = getResourceIdFilePath(resourceBasePath);
  const envVarEntries = Object.entries(envVars).reduce((fileContents: string, [key, value]) => {
    return fileContents.concat(`${key}=${value}\n`);
  }, "");

  fs.writeFileSync(resourceFilePath, envVarEntries);
}

export const getResourceIdFilePath = (resourceBasePath: string): string => ( `${resourceBasePath}/${DEFAULT_RESOURCE_ID_FILE_NAME}` );

export const printResourceSummary = (resourceType: ResourceType, resources: ResourceDetails[]) => {
  const count = resources.length;
  const summaryText = `${count > 0
    ? `Created ${count} ${resourceType}${count > 1 ? "s" : ""}:\n`
    : `No ${resourceType}s created.`}`;
  console.log(`\nDone. ${summaryText}`);
  resources.forEach((resource) => console.log(`${resource.name} (id=${resource.id})`));
}
