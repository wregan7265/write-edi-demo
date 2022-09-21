import fs from "node:fs";

export const functionNameFromPath = (fnPath: string): string => {
  // get function name excluding extension
  // path-a/path-b/path-never-ends/nice/function/handler.ts
  // => nice-function
  return fnPath.split("/").slice(-3, -1).join("-");
};

export const functionNamespaceFromPath = (fnPath: string): string => {
  // get function name excluding extension
  // path-a/path-b/path-never-ends/nice/function/handler.ts
  // => nice-function
  return fnPath.split("/").slice(-3, -1)[0];
};

export const fixtureNamespaceFromPath = (path: string): string => {
  // path-a/path-b/path-never-ends/nice/fixtures/read/map.json
  // => read
  return path.split('/').slice(-2, -1)[0];
}

export const getFunctionPaths = (pathMatch?: string) => {
  const basePath = "./src/functions";
  const namespaces = fs.readdirSync(basePath);

  const allFunctionPaths = namespaces.reduce(
    (paths: string[], namespace) => {
    if (fs.lstatSync(`./src/functions/${namespace}`).isFile()) return paths;

    return paths.concat(getAssetPaths(`${basePath}/${namespace}`, "handler.ts"));
  }, []);

  return filterPaths(allFunctionPaths, pathMatch);
};

export const getGuidePaths = (pathMatch?: string) => {
  const allGuidePaths = getAssetPaths("./src/fixtures", "guide.json");
  return filterPaths(allGuidePaths, pathMatch);
}

export const getMapPaths = (pathMatch?: string) => {
  const allMapPaths = getAssetPaths("./src/fixtures", "map.json");
  return filterPaths(allMapPaths, pathMatch);
}

const getAssetPaths = (basePath: string, defaultResourceName: string): string[] => {
  const assets = fs.readdirSync(basePath);

  return assets.reduce((collectedAssets: string[], assetName) => {
      if (fs.lstatSync(`${basePath}/${assetName}`).isFile() ||
        !fs.existsSync(`${basePath}/${assetName}/${defaultResourceName}`)) {
        return collectedAssets;
      }

      return collectedAssets.concat(`${basePath}/${assetName}/${defaultResourceName}`);
  }, []);
}

const filterPaths = (paths: string[], pathMatch?: string): string[] => {
  if (pathMatch) paths = paths.filter((path) => path.includes(`/${pathMatch}`));

  if (paths.length === 0) {
    console.error(`No matching assets found. (path filter: ${pathMatch})`);
    process.exit(1);
  }

  return paths;
}