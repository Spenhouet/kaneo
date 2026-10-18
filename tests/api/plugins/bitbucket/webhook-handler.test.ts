import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { handleBitbucketWebhookRequest } from "../../../../apps/api/src/plugins/bitbucket/webhook-handler";

const mocks = vi.hoisted(() => ({
  integrationFindFirst: vi.fn(),
  handleBitbucketPush: vi.fn(),
  handleBitbucketPullRequestOpened: vi.fn(),
  handleBitbucketPullRequestClosed: vi.fn(),
}));

vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      integrationTable: {
        findFirst: (...args: unknown[]) => mocks.integrationFindFirst(...args),
      },
    },
  },
}));

vi.mock("../../../../apps/api/src/plugins/bitbucket/webhooks/push", () => ({
  handleBitbucketPush: (...args: unknown[]) =>
    mocks.handleBitbucketPush(...args),
}));

vi.mock(
  "../../../../apps/api/src/plugins/bitbucket/webhooks/pull-request-opened",
  () => ({
    handleBitbucketPullRequestOpened: (...args: unknown[]) =>
      mocks.handleBitbucketPullRequestOpened(...args),
  }),
);

vi.mock(
  "../../../../apps/api/src/plugins/bitbucket/webhooks/pull-request-closed",
  () => ({
    handleBitbucketPullRequestClosed: (...args: unknown[]) =>
      mocks.handleBitbucketPullRequestClosed(...args),
  }),
);

const secret = "webhook-secret";
const repository = {
  full_name: "example-workspace/web",
  name: "web",
  links: { html: { href: "https://bitbucket.org/example-workspace/web" } },
};

function sign(body: string, key = secret) {
  return `sha256=${createHmac("sha256", key).update(body).digest("hex")}`;
}

function pullRequestBody(state: string) {
  return JSON.stringify({
    repository,
    pullrequest: {
      id: 3,
      title: "Fix the login button",
      description: "",
      state,
      source: { branch: { name: "kan-1" } },
      links: {
        html: {
          href: "https://bitbucket.org/example-workspace/web/pull-requests/3",
        },
      },
    },
  });
}

const pushBody = JSON.stringify({
  repository,
  push: {
    changes: [{ new: { type: "branch", name: "kan-1" }, closed: false }],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationFindFirst.mockResolvedValue({
    id: "integration-1",
    type: "bitbucket",
    config: JSON.stringify({ webhookSecret: secret }),
  });
});

describe("handleBitbucketWebhookRequest", () => {
  it("dispatches a signed push to the push handler", async () => {
    const result = await handleBitbucketWebhookRequest(
      "integration-1",
      pushBody,
      sign(pushBody),
      "repo:push",
    );

    expect(result).toEqual({ success: true });
    expect(mocks.handleBitbucketPush).toHaveBeenCalledWith(
      expect.objectContaining({ repository }),
      "integration-1",
    );
  });

  it.each(["pullrequest:created", "pullrequest:updated"])(
    "treats %s as an opened pull request",
    async (event) => {
      const body = pullRequestBody("OPEN");
      const result = await handleBitbucketWebhookRequest(
        "integration-1",
        body,
        sign(body),
        event,
      );

      expect(result.success).toBe(true);
      expect(mocks.handleBitbucketPullRequestOpened).toHaveBeenCalledTimes(1);
      expect(mocks.handleBitbucketPullRequestClosed).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["pullrequest:fulfilled", "MERGED"],
    ["pullrequest:rejected", "DECLINED"],
  ])("treats %s as a closed pull request", async (event, state) => {
    const body = pullRequestBody(state);
    const result = await handleBitbucketWebhookRequest(
      "integration-1",
      body,
      sign(body),
      event,
    );

    expect(result.success).toBe(true);
    expect(mocks.handleBitbucketPullRequestClosed).toHaveBeenCalledTimes(1);
  });

  it("rejects a body signed with another secret", async () => {
    const result = await handleBitbucketWebhookRequest(
      "integration-1",
      pushBody,
      sign(pushBody, "other-secret"),
      "repo:push",
    );

    expect(result).toEqual({
      success: false,
      error: "Invalid webhook signature",
    });
    expect(mocks.handleBitbucketPush).not.toHaveBeenCalled();
  });

  it("rejects an unsigned delivery", async () => {
    const result = await handleBitbucketWebhookRequest(
      "integration-1",
      pushBody,
      undefined,
      "repo:push",
    );

    expect(result.success).toBe(false);
    expect(mocks.handleBitbucketPush).not.toHaveBeenCalled();
  });

  it("rejects deliveries for an integration of another type", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "integration-1",
      type: "gitea",
      config: JSON.stringify({ webhookSecret: secret }),
    });

    const result = await handleBitbucketWebhookRequest(
      "integration-1",
      pushBody,
      sign(pushBody),
      "repo:push",
    );

    expect(result).toEqual({
      success: false,
      error: "Bitbucket integration not found",
    });
  });

  it("acknowledges events it does not handle", async () => {
    const body = JSON.stringify({ repository });
    const result = await handleBitbucketWebhookRequest(
      "integration-1",
      body,
      sign(body),
      "repo:commit_status_updated",
    );

    expect(result).toEqual({ success: true });
    expect(mocks.handleBitbucketPush).not.toHaveBeenCalled();
    expect(mocks.handleBitbucketPullRequestOpened).not.toHaveBeenCalled();
    expect(mocks.handleBitbucketPullRequestClosed).not.toHaveBeenCalled();
  });

  it("ignores a pull request payload without a source branch", async () => {
    const body = JSON.stringify({
      repository,
      pullrequest: { id: 3, title: "No branch", state: "OPEN" },
    });
    const result = await handleBitbucketWebhookRequest(
      "integration-1",
      body,
      sign(body),
      "pullrequest:created",
    );

    expect(result.success).toBe(true);
    expect(mocks.handleBitbucketPullRequestOpened).not.toHaveBeenCalled();
  });
});
