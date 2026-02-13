import crypto from "crypto";

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function encodeIntentPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  return base64UrlEncode(Buffer.from(json, "utf8"));
}

export function signIntentPayload(payloadB64Url: string, secret: string): string {
  const mac = crypto
    .createHmac("sha256", secret)
    .update(payloadB64Url, "utf8")
    .digest();
  return base64UrlEncode(mac);
}

