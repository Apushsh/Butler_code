// 生成「作者密钥」：用来给插件包签名（market 索引里的 authorKeys / authorSignature）。
// 与市场索引签名密钥（plugin-index-signing.key）是两把不同的钥匙：
//   - 索引密钥：签 index.v3.json / revoked.v3.json，公钥写死在客户端 DEFAULT_TRUST；
//   - 作者密钥：签插件包（domain "focusd-plugin-package/1"）和版本提交信息，公钥放在索引的 authorKeys 里。
// 用法：node scripts/plugins/author-keygen.mjs
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dpapi, keyIdOf, rawPublicKey } from "./plugin-signing.mjs";
import { AUTHOR_KEY_FILE, AUTHOR_KEY_PATH } from "./package-signing.mjs";

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  if (existsSync(AUTHOR_KEY_FILE)) throw new Error(`${AUTHOR_KEY_FILE} already exists; delete it only if you mean to replace the author key`);

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = rawPublicKey(publicKey);
  const keyId = keyIdOf(raw);

  mkdirSync(path.dirname(AUTHOR_KEY_FILE), { recursive: true });
  writeFileSync(AUTHOR_KEY_FILE, dpapi("Protect", Buffer.from(privateKey.export({ format: "pem", type: "pkcs8" }), "utf8")).toString("base64"));

  const target = path.join(root, AUTHOR_KEY_PATH);
  writeFileSync(target, `${JSON.stringify({ keyId, publicKey: raw.toString("base64") }, null, 2)}\n`);

  console.log(`Saved the author private key to ${AUTHOR_KEY_FILE} (DPAPI, current Windows user).`);
  console.log(`Public key ${keyId} written to ${AUTHOR_KEY_PATH}.`);
  console.log("Back this up: without it you cannot sign new plugin versions under the same identity.");
}

main();
