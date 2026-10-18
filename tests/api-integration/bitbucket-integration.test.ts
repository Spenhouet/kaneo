import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { createBitbucketClient } from "../../apps/api/src/plugins/bitbucket/utils/bitbucket-api";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock(
  "../../apps/api/src/plugins/bitbucket/utils/bitbucket-api",
  async (original) => ({
    ...(await original<object>()),
    createBitbucketClient: vi.fn(),
  }),
);

const secret = "test-webhook-secret";
const repository = {
  full_name: "example-workspace/web",
  name: "web",
  links: { html: { href: "https://bitbucket.org/example-workspace/web" } },
};

beforeEach(async () => {
  await resetTestDatabase();
  vi.mocked(createBitbucketClient).mockReturnValue({
    getRepository: vi.fn(async () => ({
      uuid: "{1}",
      name: "web",
      slug: "web",
      full_name: "example-workspace/web",
      is_private: true,
    })),
    canReadPullRequests: vi.fn(async () => true),
    listRepositories: vi.fn(async () => []),
  });
});

async function linkedProject() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
    slug: "KAN",
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number: 1,
      title: "card",
      status: "to-do",
    })
    .returning();
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "bitbucket",
      config: JSON.stringify({
        workspace: "example-workspace",
        repositorySlug: "web",
        authType: "access_token",
        accessToken: "test-only",
        webhookSecret: secret,
        branchPattern: "{slug}-{number}",
      }),
    })
    .returning();
  return { owner, project, columns, task, integration };
}

function deliver(
  integrationId: string,
  event: string,
  payload: unknown,
  key = secret,
) {
  const body = JSON.stringify(payload);
  const { app } = createApp();
  return app.request(`/api/bitbucket-integration/webhook/${integrationId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Event-Key": event,
      "X-Hub-Signature": `sha256=${createHmac("sha256", key).update(body).digest("hex")}`,
    },
    body,
  });
}

function pullRequest(state: string, overrides: Record<string, unknown> = {}) {
  return {
    repository,
    pullrequest: {
      id: 7,
      title: "Fix the login button",
      description: "",
      state,
      draft: false,
      author: { display_name: "Example Dev" },
      source: { branch: { name: "kan-1-login" } },
      links: {
        html: {
          href: "https://bitbucket.org/example-workspace/web/pull-requests/7",
        },
      },
      ...overrides,
    },
  };
}

async function taskStatus(taskId: string) {
  const task = await db.query.taskTable.findFirst({
    where: eq(schema.taskTable.id, taskId),
  });
  return task?.status;
}

async function links(taskId: string, resourceType: string) {
  return db.query.externalLinkTable.findMany({
    where: and(
      eq(schema.externalLinkTable.taskId, taskId),
      eq(schema.externalLinkTable.resourceType, resourceType),
    ),
  });
}

describe("Bitbucket webhooks", () => {
  it("links a pushed branch and moves the task to in progress", async () => {
    const { task, integration } = await linkedProject();

    const response = await deliver(integration.id, "repo:push", {
      repository,
      push: {
        changes: [
          {
            new: {
              type: "branch",
              name: "KAN-1-login",
              target: {
                hash: "abc123",
                message: "Fix login",
                date: "2026-01-01T00:00:00+00:00",
                author: { raw: "Example Dev <dev@example.com>" },
              },
            },
            closed: false,
          },
          { new: null, closed: true },
        ],
      },
    });

    expect(response.status).toBe(200);
    expect(await taskStatus(task.id)).toBe("in-progress");
    const [branch] = await links(task.id, "branch");
    expect(branch?.url).toBe(
      "https://bitbucket.org/example-workspace/web/branch/KAN-1-login",
    );
    expect(JSON.parse(branch?.metadata ?? "{}").lastCommit).toMatchObject({
      sha: "abc123",
      author: "Example Dev <dev@example.com>",
    });
  });

  it("ignores pushes to protected branches and tags", async () => {
    const { task, integration } = await linkedProject();

    const response = await deliver(integration.id, "repo:push", {
      repository,
      push: {
        changes: [
          { new: { type: "branch", name: "main" } },
          { new: { type: "tag", name: "KAN-1" } },
        ],
      },
    });

    expect(response.status).toBe(200);
    expect(await taskStatus(task.id)).toBe("to-do");
    expect(await links(task.id, "branch")).toHaveLength(0);
  });

  it("follows a pull request from opened to merged", async () => {
    const { task, integration } = await linkedProject();

    expect(
      (
        await deliver(
          integration.id,
          "pullrequest:created",
          pullRequest("OPEN"),
        )
      ).status,
    ).toBe(200);
    expect(await taskStatus(task.id)).toBe("in-review");
    const [opened] = await links(task.id, "pull_request");
    expect(opened).toMatchObject({
      externalId: "7",
      url: "https://bitbucket.org/example-workspace/web/pull-requests/7",
      title: "Fix the login button",
    });

    expect(
      (
        await deliver(
          integration.id,
          "pullrequest:fulfilled",
          pullRequest("MERGED"),
        )
      ).status,
    ).toBe(200);
    expect(await taskStatus(task.id)).toBe("done");
    const [merged] = await links(task.id, "pull_request");
    expect(JSON.parse(merged?.metadata ?? "{}")).toMatchObject({
      state: "closed",
      merged: true,
    });
  });

  it("leaves the task in review when a pull request is declined", async () => {
    const { task, integration } = await linkedProject();

    await deliver(integration.id, "pullrequest:created", pullRequest("OPEN"));
    await deliver(
      integration.id,
      "pullrequest:rejected",
      pullRequest("DECLINED"),
    );

    expect(await taskStatus(task.id)).toBe("in-review");
    const [declined] = await links(task.id, "pull_request");
    expect(JSON.parse(declined?.metadata ?? "{}")).toMatchObject({
      state: "closed",
      merged: false,
    });
  });

  it("finds the task from a reference in the pull request title", async () => {
    const { task, integration } = await linkedProject();

    await deliver(
      integration.id,
      "pullrequest:updated",
      pullRequest("OPEN", {
        title: "KAN-1 Fix the login button",
        source: { branch: { name: "login-fix" } },
      }),
    );

    expect(await links(task.id, "pull_request")).toHaveLength(1);
  });

  it("uses the column from the project's workflow rule", async () => {
    const { project, columns, task, integration } = await linkedProject();
    await db.insert(schema.workflowRuleTable).values({
      projectId: project.id,
      integrationType: "bitbucket",
      eventType: "pr_opened",
      columnId: columns.done.id,
    });

    await deliver(integration.id, "pullrequest:created", pullRequest("OPEN"));

    expect(await taskStatus(task.id)).toBe("done");
  });

  it("rejects a delivery signed with another secret", async () => {
    const { task, integration } = await linkedProject();

    const response = await deliver(
      integration.id,
      "pullrequest:created",
      pullRequest("OPEN"),
      "wrong-secret",
    );

    expect(response.status).toBe(400);
    expect(await taskStatus(task.id)).toBe("to-do");
  });

  it("ignores deliveries for a paused integration", async () => {
    const { task, integration } = await linkedProject();
    await db
      .update(schema.integrationTable)
      .set({ isActive: false })
      .where(eq(schema.integrationTable.id, integration.id));

    await deliver(integration.id, "pullrequest:created", pullRequest("OPEN"));

    expect(await taskStatus(task.id)).toBe("to-do");
  });

  it("ignores events for another repository", async () => {
    const { task, integration } = await linkedProject();

    await deliver(integration.id, "pullrequest:created", {
      ...pullRequest("OPEN"),
      repository: { ...repository, full_name: "example-workspace/other" },
    });

    expect(await links(task.id, "pull_request")).toHaveLength(0);
  });
});

describe("Bitbucket integration routes", () => {
  it("connects a repository and returns the webhook settings once", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/bitbucket-integration/project/${project.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: "Example-Workspace",
          repositorySlug: "web",
          authType: "api_token",
          email: "dev@example.com",
          accessToken: "secret-api-token",
        }),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      workspace: "example-workspace",
      repositorySlug: "web",
      authType: "api_token",
      email: "dev@example.com",
      maskedAccessToken: "secr••••••oken",
      isActive: true,
    });
    expect(body.webhookUrl).toBe(
      `http://localhost:1337/api/bitbucket-integration/webhook/${body.id}`,
    );
    expect(body.webhookSecret).toMatch(/^[0-9a-f]{48}$/);
    expect(JSON.stringify(body)).not.toContain("secret-api-token");

    const reconnect = await app.request(
      `/api/bitbucket-integration/project/${project.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: "example-workspace",
          repositorySlug: "web",
        }),
      },
    );
    expect(reconnect.status).toBe(200);
    expect((await reconnect.json()).webhookSecret).toBe(body.webhookSecret);
  });

  it("refuses to link a repository that another project uses", async () => {
    const { owner } = await linkedProject();
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/bitbucket-integration/project/${project.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: "example-workspace",
          repositorySlug: "web",
          authType: "access_token",
          accessToken: "token",
        }),
      },
    );

    expect(response.status).toBe(409);
  });

  it("hides the webhook secret from members without settings access", async () => {
    const { owner, project } = await linkedProject();
    const member = await createWorkspaceMember({ role: "member" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/bitbucket-integration/project/${project.id}`,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).webhookSecret).toBe("");
  });

  it("requires a session to verify access", async () => {
    const { project } = await linkedProject();
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/bitbucket-integration/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        workspace: "example-workspace",
        repositorySlug: "web",
      }),
    });

    expect(response.status).toBe(401);
  });
});
