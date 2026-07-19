import { createHash, generateKeyPairSync } from "node:crypto";

// https://developer.chrome.com/docs/extensions/reference/manifest/key
// https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux
const { publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const manifestKey = publicKey.toString("base64");
const extensionId = createHash("sha256")
  .update(publicKey)
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (digit) =>
    String.fromCharCode("a".charCodeAt(0) + Number.parseInt(digit, 16)),
  );

console.log(`Manifest key:\n${manifestKey}\n\nExtension ID:\n${extensionId}`);
