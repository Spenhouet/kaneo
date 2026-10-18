import { createHmac, timingSafeEqual } from "node:crypto";

// Bitbucket Cloud signs webhook bodies with the webhook secret and sends the
// result as "sha256=<hex>" in X-Hub-Signature.
export function verifyBitbucketSignature(
  payload: string,
  secret: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const provided = signatureHeader.trim();
  if (!provided.toLowerCase().startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(provided.slice(7), "hex");
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
