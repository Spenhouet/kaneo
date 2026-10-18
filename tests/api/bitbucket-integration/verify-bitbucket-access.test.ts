import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  getRepository: vi.fn(),
  canReadPullRequests: vi.fn(),
}));

class BitbucketApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: string,
  ) {
    super(message);
  }
}

vi.mock("../../../apps/api/src/plugins/bitbucket/utils/bitbucket-api", () => ({
  BitbucketApiError,
  createBitbucketClient: () => ({
    getRepository: (...args: unknown[]) => mocks.getRepository(...args),
    canReadPullRequests: (...args: unknown[]) =>
      mocks.canReadPullRequests(...args),
  }),
}));

const { default: verifyBitbucketAccess } =
  await import("../../../apps/api/src/bitbucket-integration/controllers/verify-bitbucket-access");

const input = {
  credentials: { authType: "access_token" as const, accessToken: "token" },
  workspace: "example-workspace",
  repositorySlug: "web",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyBitbucketAccess", () => {
  it("passes when the token reads the repository and its pull requests", async () => {
    mocks.getRepository.mockResolvedValue({ is_private: true });
    mocks.canReadPullRequests.mockResolvedValue(true);

    expect(await verifyBitbucketAccess(input)).toEqual({
      isInstalled: true,
      hasRequiredPermissions: true,
      repositoryExists: true,
      repositoryPrivate: true,
      missingPermissions: [],
      message: "Token can access the repository.",
      failureReason: null,
    });
  });

  it("names the missing pull request scope", async () => {
    mocks.getRepository.mockResolvedValue({ is_private: false });
    mocks.canReadPullRequests.mockResolvedValue(false);

    const result = await verifyBitbucketAccess(input);

    expect(result.hasRequiredPermissions).toBe(false);
    expect(result.missingPermissions).toEqual(["pull requests (read)"]);
    expect(result.failureReason).toBeNull();
  });

  it("reports rejected credentials", async () => {
    mocks.getRepository.mockRejectedValue(
      new BitbucketApiError("Bitbucket API error 401", 401, "HTTP_ERROR"),
    );

    const result = await verifyBitbucketAccess(input);

    expect(result.isInstalled).toBe(false);
    expect(result.failureReason).toBe("invalid_credentials");
  });

  it("reports a repository the token cannot see", async () => {
    mocks.getRepository.mockRejectedValue(
      new BitbucketApiError("Bitbucket API error 404", 404, "HTTP_ERROR"),
    );

    const result = await verifyBitbucketAccess(input);

    expect(result.repositoryExists).toBe(false);
    expect(result.failureReason).toBe("repository_not_found");
  });

  it("raises other failures", async () => {
    mocks.getRepository.mockRejectedValue(new Error("network down"));

    await expect(verifyBitbucketAccess(input)).rejects.toMatchObject({
      status: 500,
    });
  });
});
