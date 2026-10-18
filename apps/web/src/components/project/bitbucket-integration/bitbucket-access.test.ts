import { describe, expect, it } from "vite-plus/test";
import {
  bitbucketAccessKey,
  bitbucketCredentials,
  workspaceFromPath,
} from "@/components/project/bitbucket-integration/bitbucket-access";

describe("bitbucketCredentials", () => {
  it("needs an email for an API token", () => {
    expect(bitbucketCredentials("api_token", "", "token")).toBeNull();
    expect(
      bitbucketCredentials("api_token", "dev@example.com", "token"),
    ).toEqual({
      authType: "api_token",
      email: "dev@example.com",
      accessToken: "token",
    });
  });

  it("ignores the email for an access token", () => {
    expect(
      bitbucketCredentials("access_token", "dev@example.com", " token "),
    ).toEqual({ authType: "access_token", accessToken: "token" });
  });

  it("needs a token", () => {
    expect(bitbucketCredentials("access_token", "", "  ")).toBeNull();
  });
});

describe("bitbucketAccessKey", () => {
  it("changes with the credentials without containing the token", () => {
    const stored = bitbucketAccessKey({
      workspace: "example-workspace",
      repositorySlug: "web",
    });
    const withToken = bitbucketAccessKey({
      workspace: "example-workspace",
      repositorySlug: "web",
      credentials: { authType: "access_token", accessToken: "secret-token" },
    });
    expect(stored).not.toBe(withToken);
    expect(withToken).not.toContain("secret-token");
  });
});

describe("workspaceFromPath", () => {
  it("reads the workspace before the slash", () => {
    expect(workspaceFromPath("example-workspace/web")).toBe(
      "example-workspace",
    );
    expect(workspaceFromPath("example-workspace/")).toBe("example-workspace");
    expect(workspaceFromPath("not valid/")).toBe("");
  });
});
