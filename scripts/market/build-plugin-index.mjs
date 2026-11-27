// 生成个人插件市场仓库（Butler_plugin）的 v3 文档：
//   index.v3.json + .sig（插件索引，市场签名密钥签）
//   revoked.v3.json + .sig（吊销列表，空表）
//   themes.json（主题市场，空表）
// 插件版本条目里的 authorSignature 用「作者密钥」签 {name, version, repository, commit}。
// 用法（在 E:\AUPJI\autoget\myfuyu 下，用改名 node 跑以免产物被加密）：
//   node scripts/market/build-plugin-index.mjs [--repo <市场仓库目录>]
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPrivateKey, signIndex, verifyIndex } from "../plugins/plugin-signing.mjs";
import { loadAuthorKey, sha256 } from "../plugins/package-signing.mjs";
import { signCommit } from "../../packages/plugin-market/src/author.mjs";
import { validateIndex } from "../../packages/plugin-market/src/index-format.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PLUGIN_SOURCE = "E:\\AUPJI\\fuyu-plugin";
const repoArg = process.argv.includes("--repo") ? process.argv[process.argv.indexOf("--repo") + 1] : null;
const MARKET = path.resolve(repoArg || "E:\\AUPJI\\autoget\\Butler_plugin");
const GITHUB = "Apushsh";
const REPO = "Butler_plugin";
const PLUGIN_NAME = "@apushsh/fuyu-checkin";
const VERSION = "0.1.0";
const RAW = `https://raw.githubusercontent.com/${GITHUB}/${REPO}/main`;

const HASH = "bfcfa6f0a44bc163";
const CODE_COMMIT = "59349ddbea23b221e199dd4d7d613e8fe8e27209";

const pkgJson = JSON.parse(readFileSync(path.join(PLUGIN_SOURCE, "package.json"), "utf8"));
const manifest = pkgJson.fuyu;
const packageFile = path.join(MARKET, "packages", `apushsh-fuyu-checkin-${VERSION}.fuyu`);
const iconFile = path.join(PLUGIN_SOURCE, "assets", "icon.svg");
const marketIcon = path.join(MARKET, "assets", "icon.svg");

mkdirSync(path.join(MARKET, "assets"), { recursive: true });
if (!existsSync(marketIcon)) copyFileSync(iconFile, marketIcon);

const authorKey = loadAuthorKey(ROOT);
const author = JSON.parse(readFileSync(path.join(ROOT, "plugins", "author-key.json"), "utf8"));
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const expires = new Date(Date.now() + 3650 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

const versionEntry = {
  version: VERSION,
  repository: `https://github.com/${GITHUB}/${REPO}`,
  commit: CODE_COMMIT,
  engines: { fuyu: manifest.engines?.fuyu ?? pkgJson.engines?.fuyu ?? ">=0.3.14" },
  platforms: ["windows", "macos"],
  url: `${RAW}/packages/apushsh-fuyu-checkin-${VERSION}.fuyu`,
  sha256: sha256(readFileSync(packageFile)),
  size: statSync(packageFile).size,
  publishedAt: now,
  reviewedAt: now,
  manifest: {
    displayName: manifest.displayName,
    description: manifest.description,
    license: pkgJson.license ?? "MIT",
    nodeApis: manifest.nodeApis ?? [],
    network: manifest.network ?? [],
    provides: manifest.provides ?? [],
    replaces: manifest.replaces ?? [],
    slots: manifest.slots ?? [],
    inject: { required: manifest.inject?.required ?? [], optional: manifest.inject?.optional ?? [] },
    commands: [],
    categories: manifest.categories,
    keywords: pkgJson.keywords,
  },
  icon: { url: `${RAW}/assets/icon.svg`, sha256: sha256(readFileSync(marketIcon)) },
  screenshots: [],
  authorSignature: signCommit({ name: PLUGIN_NAME, version: VERSION, repository: `https://github.com/${GITHUB}/${REPO}`, commit: CODE_COMMIT }, authorKey),
};

const doc = {
  format: 3,
  serial: 1,
  generatedAt: now,
  expires,
  plugins: [{
    name: PLUGIN_NAME,
    publisher: { github: GITHUB, official: false },
    authorKeys: [author],
    versions: [versionEntry],
  }],
  bundles: [],
};

const problems = validateIndex(doc);
if (problems.length) throw new Error(`index 不自洽: ${JSON.stringify(problems, null, 2)}`);

const indexPath = path.join(MARKET, "index.v3.json");
const text = `${JSON.stringify(doc, null, 2)}\n`;
writeFileSync(indexPath, text);
const indexKey = loadPrivateKey();
writeFileSync(`${indexPath}.sig`, `${JSON.stringify(signIndex(text, indexKey), null, 2)}\n`);
if (!verifyIndex(text, JSON.parse(readFileSync(`${indexPath}.sig`, "utf8")), [{ keyId: HASH, publicKey: "zFS7LtqU5tEcZlLtVxpPYx3Ea1RZ+GI+vLPJzaZnfzE=" }])) {
  throw new Error("索引签名自验失败");
}

for (const [name, body] of [
  ["revoked.v3.json", { format: 3, serial: 1, generatedAt: now, expires, entries: [], withdrawn: [] }],
]) {
  const file = path.join(MARKET, name);
  const bodyText = `${JSON.stringify(body, null, 2)}\n`;
  writeFileSync(file, bodyText);
  writeFileSync(`${file}.sig`, `${JSON.stringify(signIndex(bodyText, indexKey), null, 2)}\n`);
}

writeFileSync(path.join(MARKET, "themes.json"), `${JSON.stringify({ version: 1, generatedAt: now, themes: [] }, null, 2)}\n`);

console.log(`market: ${MARKET}`);
console.log(`index: ${indexPath} (${statSync(indexPath).size} B), sig ok`);
console.log(`plugin: ${PLUGIN_NAME}@${VERSION}, sha256 ${versionEntry.sha256}`);
