import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ integrationFindFirst: vi.fn() }));

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      integrationTable: {
        findFirst: (...args: unknown[]) => mocks.integrationFindFirst(...args),
      },
    },
  },
}));

const { resolveBitbucketCredentials } =
  await import("../../../apps/api/src/bitbucket-integration/controllers/resolve-credentials");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveBitbucketCredentials", () => {
  it("uses new credentials when a token is given", async () => {
    await expect(
      resolveBitbucketCredentials({
        projectId: "project-1",
        authType: "api_token",
        email: "dev@example.com",
        accessToken: " token ",
      }),
    ).resolves.toEqual({
      authType: "api_token",
      email: "dev@example.com",
      accessToken: "token",
    });
    expect(mocks.integrationFindFirst).not.toHaveBeenCalled();
  });

  it("drops the email for an access token", async () => {
    await expect(
      resolveBitbucketCredentials({
        projectId: "project-1",
        authType: "access_token",
        email: "dev@example.com",
        accessToken: "token",
      }),
    ).resolves.toEqual({ authType: "access_token", accessToken: "token" });
  });

  it("requires an email for an API token", async () => {
    await expect(
      resolveBitbucketCredentials({
        projectId: "project-1",
        authType: "api_token",
        accessToken: "token",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("falls back to the saved credentials", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      config: JSON.stringify({
        authType: "api_token",
        email: "dev@example.com",
        accessToken: "saved",
      }),
    });

    await expect(
      resolveBitbucketCredentials({ projectId: "project-1" }),
    ).resolves.toEqual({
      authType: "api_token",
      email: "dev@example.com",
      accessToken: "saved",
    });
  });

  it("asks for a token when nothing is saved", async () => {
    mocks.integrationFindFirst.mockResolvedValue(undefined);

    await expect(
      resolveBitbucketCredentials({ projectId: "project-1" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
