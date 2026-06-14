import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function randomSecret() {
  return crypto.randomBytes(48).toString("base64url");
}

export function loadRuntimeSecrets(rootDir) {
  const dataDir = path.join(rootDir, "data");
  const secretPath = path.join(dataDir, "runtime-secrets.json");
  fs.mkdirSync(dataDir, { recursive: true });

  try {
    const saved = JSON.parse(fs.readFileSync(secretPath, "utf8"));
    if (saved.sessionSecret && saved.ipHashSecret && saved.providerEncryptionKey) {
      return saved;
    }
  } catch {
    // Generate a complete replacement when the file is absent or invalid.
  }

  const secrets = {
    sessionSecret: randomSecret(),
    ipHashSecret: randomSecret(),
    providerEncryptionKey: randomSecret(),
  };
  fs.writeFileSync(secretPath, `${JSON.stringify(secrets, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return secrets;
}
