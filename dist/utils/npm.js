"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLatestTarballUrl = fetchLatestTarballUrl;
exports.downloadTarball = downloadTarball;
const node_https_1 = __importDefault(require("node:https"));
const node_fs_1 = __importDefault(require("node:fs"));
function fetchLatestTarballUrl(packageName) {
    return new Promise((resolve, reject) => {
        const encodedPackageName = packageName.replace("/", "%2f");
        const url = `https://registry.npmjs.org/${encodedPackageName}/latest`;
        node_https_1.default.get(url, { headers: { "User-Agent": "kava-cli" } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch latest version info for ${packageName} from npm registry. Status: ${res.statusCode} ${res.statusMessage}`));
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
                }
                catch (err) {
                    reject(err);
                }
            });
        }).on("error", (err) => {
            reject(new Error(`Network error while contacting npm registry: ${err.message}`));
        });
    });
}
function downloadTarball(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = node_fs_1.default.createWriteStream(destPath);
        node_https_1.default.get(url, { headers: { "User-Agent": "kava-cli" } }, (res) => {
            if (res.statusCode !== 200) {
                file.close();
                node_fs_1.default.unlink(destPath, () => { });
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
            node_fs_1.default.unlink(destPath, () => { });
            reject(err);
        });
    });
}
