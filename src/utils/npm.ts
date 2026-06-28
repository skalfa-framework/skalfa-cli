import https from "node:https";
import fs from "node:fs";

export function fetchLatestTarballUrl(packageName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodedPackageName = packageName.replace("/", "%2f");
    const url = `https://registry.npmjs.org/${encodedPackageName}/latest`;

    https.get(url, { headers: { "User-Agent": "skalfa-cli" } }, (res) => {
      if (res.statusCode !== 200) {
        reject(
          new Error(
            `Failed to fetch latest version info for ${packageName} from npm registry. Status: ${res.statusCode} ${res.statusMessage}`
          )
        );
        return;
      }

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const tarballUrl = json.dist?.tarball;
          if (!tarballUrl) {
            reject(new Error(`Could not find tarball URL in registry response for ${packageName}.`));
            return;
          }
          resolve(tarballUrl);
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", (err) => {
      reject(new Error(`Network error while contacting npm registry: ${err.message}`));
    });
  });
}

export function downloadTarball(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { "User-Agent": "skalfa-cli" } }, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to download tarball from ${url}. Status: ${res.statusCode} ${res.statusMessage}`));
        return;
      }

      res.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

export function fetchLatestVersion(packageName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodedPackageName = packageName.replace("/", "%2f");
    const url = `https://registry.npmjs.org/${encodedPackageName}/latest`;

    https.get(url, { headers: { "User-Agent": "skalfa-cli" } }, (res) => {
      if (res.statusCode !== 200) {
        reject(
          new Error(
            `Failed to fetch latest version info for ${packageName} from npm registry. Status: ${res.statusCode} ${res.statusMessage}`
          )
        );
        return;
      }

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const version = json.version;
          if (!version) {
            reject(new Error(`Could not find version in registry response for ${packageName}.`));
            return;
          }
          resolve(version);
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", (err) => {
      reject(new Error(`Network error while contacting npm registry: ${err.message}`));
    });
  });
}

