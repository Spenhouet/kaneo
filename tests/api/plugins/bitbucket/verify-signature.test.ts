import { createHmac } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { verifyBitbucketSignature } from "../../../../apps/api/src/plugins/bitbucket/utils/verify-signature";

const body = '{"push":{"changes":[]}}';
const digest = createHmac("sha256", "secret").update(body).digest("hex");

describe("verifyBitbucketSignature", () => {
  it("accepts the sha256 signature Bitbucket sends", () => {
    expect(verifyBitbucketSignature(body, "secret", `sha256=${digest}`)).toBe(
      true,
    );
  });

  it("rejects a signature over a different body", () => {
    expect(
      verifyBitbucketSignature(`${body} `, "secret", `sha256=${digest}`),
    ).toBe(false);
  });

  it("rejects a signature without the algorithm prefix", () => {
    expect(verifyBitbucketSignature(body, "secret", digest)).toBe(false);
  });

  it("rejects a malformed or truncated signature", () => {
    expect(verifyBitbucketSignature(body, "secret", "sha256=zz")).toBe(false);
    expect(
      verifyBitbucketSignature(body, "secret", `sha256=${digest.slice(2)}`),
    ).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    expect(verifyBitbucketSignature(body, "", `sha256=${digest}`)).toBe(false);
  });
});
