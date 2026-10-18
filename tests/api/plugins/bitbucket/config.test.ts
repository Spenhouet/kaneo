import { describe, expect, it } from "vite-plus/test";
import {
  bitbucketConfigSchema,
  validateBitbucketConfig,
} from "../../../../apps/api/src/plugins/bitbucket/config";
import * as v from "valibot";

const base = {
  workspace: "Example-Workspace",
  repositorySlug: "web",
  accessToken: "test-token",
};

describe("validateBitbucketConfig", () => {
  it("accepts an API token with an account email", async () => {
    expect(
      await validateBitbucketConfig({
        ...base,
        authType: "api_token",
        email: "dev@example.com",
      }),
    ).toEqual({ valid: true });
  });

  it("accepts an access token without an email", async () => {
    expect(
      await validateBitbucketConfig({ ...base, authType: "access_token" }),
    ).toEqual({ valid: true });
  });

  it("requires an email for an API token", async () => {
    const result = await validateBitbucketConfig({
      ...base,
      authType: "api_token",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects unknown auth types", async () => {
    const result = await validateBitbucketConfig({
      ...base,
      authType: "app_password",
    });
    expect(result.valid).toBe(false);
  });

  it("stores workspace and repository slugs in lowercase", () => {
    const parsed = v.parse(bitbucketConfigSchema, {
      ...base,
      authType: "access_token",
    });
    expect(parsed.workspace).toBe("example-workspace");
  });
});
