import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  BitbucketApiError,
  bitbucketAuthHeader,
  createBitbucketClient,
} from "../../../../apps/api/src/plugins/bitbucket/utils/bitbucket-api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bitbucketAuthHeader", () => {
  it("sends an API token as basic auth with the account email", () => {
    const header = bitbucketAuthHeader({
      authType: "api_token",
      email: "dev@example.com",
      accessToken: "token",
    });
    expect(header).toBe(
      `Basic ${Buffer.from("dev@example.com:token").toString("base64")}`,
    );
  });

  it("sends an access token as a bearer token", () => {
    expect(
      bitbucketAuthHeader({ authType: "access_token", accessToken: "token" }),
    ).toBe("Bearer token");
  });
});

describe("createBitbucketClient", () => {
  const client = createBitbucketClient({
    authType: "access_token",
    accessToken: "token",
  });

  it("follows pagination links on the API host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          values: [{ slug: "a" }],
          next: "https://api.bitbucket.org/2.0/repositories/example-workspace?page=2",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ values: [{ slug: "b" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const repositories = await client.listRepositories("example-workspace");

    expect(repositories.map((repository) => repository.slug)).toEqual([
      "a",
      "b",
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.bitbucket.org/2.0/repositories/example-workspace?pagelen=100&sort=slug",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer token",
    });
  });

  it("refuses a pagination link to another host", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        values: [],
        next: "https://attacker.example/collect",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      client.listRepositories("example-workspace"),
    ).rejects.toBeInstanceOf(BitbucketApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports missing pull request access as false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 403)),
    );

    await expect(
      client.canReadPullRequests("example-workspace", "web"),
    ).resolves.toBe(false);
  });

  it("raises an API error with the HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 401)),
    );

    await expect(
      client.getRepository("example-workspace", "web"),
    ).rejects.toMatchObject({ status: 401, kind: "HTTP_ERROR" });
  });
});
