import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { default: listGiteaRepositories } =
  await import("../../../apps/api/src/gitea-integration/controllers/list-gitea-repositories");

const originalAllowPrivate =
  process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

afterEach(() => {
  if (originalAllowPrivate === undefined) {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
  } else {
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = originalAllowPrivate;
  }
  vi.unstubAllGlobals();
});

describe("listGiteaRepositories", () => {
  it("names the private address setting when the server is on a private network", async () => {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const error = await listGiteaRepositories({
      baseUrl: "http://10.0.0.5:3000",
      accessToken: "token",
    }).catch((e: unknown) => e);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(error).toMatchObject({ status: 400 });
    expect((error as Error).message).toContain(
      "KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS",
    );
  });

  it("keeps the generic message when the token is rejected", async () => {
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"message":"token is required"}', { status: 401 }),
        ) as unknown as typeof fetch,
    );

    await expect(
      listGiteaRepositories({
        baseUrl: "https://gitea.example",
        accessToken: "token",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Invalid Gitea token or could not reach instance.",
    });
  });
});
