import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { integrationTable } from "../database/schema";
import { publishEvent } from "../events";
import { projectIdParam } from "../integrations/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { handleBitbucketWebhookRequest } from "../plugins/bitbucket/webhook-handler";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createBitbucketIntegration from "./controllers/create-bitbucket-integration";
import deleteBitbucketIntegration from "./controllers/delete-bitbucket-integration";
import getBitbucketIntegration from "./controllers/get-bitbucket-integration";
import listBitbucketRepositories from "./controllers/list-bitbucket-repositories";
import { resolveBitbucketCredentials } from "./controllers/resolve-credentials";
import verifyBitbucketAccess from "./controllers/verify-bitbucket-access";
import {
  bitbucketDeleteResultSchema,
  bitbucketIntegrationSchema,
  bitbucketRepositoryListSchema,
  bitbucketVerificationResultSchema,
} from "./response";
import {
  createBitbucketBody,
  listBitbucketRepositoriesBody,
  updateBitbucketBody,
  verifyBitbucketBody,
} from "./schema";

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const listRepositoriesRoute = createRoute({
  method: "post",
  operationId: "listBitbucketRepositories",
  path: "/repositories",
  tags: ["Bitbucket"],
  summary: "List Bitbucket repositories",
  description:
    "List the repositories of a Bitbucket Cloud workspace that the credentials can reach, for picking one to link. Sent as a POST because the token travels in the body rather than the URL.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: listBitbucketRepositoriesBody },
      },
    },
  },
  responses: {
    200: jsonResponse("Accessible repositories", bitbucketRepositoryListSchema),
    400: errorResponse("Invalid body, or invalid Bitbucket credentials"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

const verifyRoute = createRoute({
  method: "post",
  operationId: "verifyBitbucketAccess",
  path: "/verify",
  tags: ["Bitbucket"],
  summary: "Verify Bitbucket access",
  description:
    "Check that the credentials reach the repository and can read its pull requests. Credential and permission failures are reported in the body. Omit accessToken to use the saved credentials.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: verifyBitbucketBody } },
    },
  },
  responses: {
    200: jsonResponse("Verification result", bitbucketVerificationResultSchema),
    400: errorResponse("Invalid body, or no saved credentials"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
    500: errorResponse("Bitbucket verification failed"),
  },
});

const getIntegrationRoute = createRoute({
  method: "get",
  operationId: "getBitbucketIntegration",
  path: "/project/{projectId}",
  tags: ["Bitbucket"],
  summary: "Get Bitbucket integration",
  description:
    "Get the Bitbucket integration for a project, or null when none is configured. The webhook secret is included only for callers with workspace:manage_settings.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Bitbucket integration details, or null",
      bitbucketIntegrationSchema.nullable(),
    ),
    403: errorResponse("No access to the project"),
    404: errorResponse("Project not found"),
  },
});

const createIntegrationRoute = createRoute({
  method: "post",
  operationId: "createBitbucketIntegration",
  path: "/project/{projectId}",
  tags: ["Bitbucket"],
  summary: "Create Bitbucket integration",
  description:
    "Link a project to a Bitbucket Cloud repository. The response carries the webhook URL and secret to add in the repository settings.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createBitbucketBody } },
    },
  },
  responses: {
    200: jsonResponse("The stored integration", bitbucketIntegrationSchema),
    400: errorResponse("Invalid body, or repository not reachable"),
    401: errorResponse("Bitbucket rejected the credentials"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
    409: errorResponse("Repository already linked to another project"),
  },
});

const updateIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateBitbucketIntegration",
  path: "/project/{projectId}",
  tags: ["Bitbucket"],
  summary: "Update Bitbucket integration",
  description:
    "Pause or resume the Bitbucket integration. Omitted fields keep their current value.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateBitbucketBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated integration", bitbucketIntegrationSchema),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project or integration not found"),
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteBitbucketIntegration",
  path: "/project/{projectId}",
  tags: ["Bitbucket"],
  summary: "Delete Bitbucket integration",
  description: "Unlink a project from its Bitbucket repository.",
  middleware: manageAccess,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "The integration was removed",
      bitbucketDeleteResultSchema,
    ),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project or Bitbucket integration not found"),
  },
});

async function loadIntegration(projectId: string) {
  const integration = await getBitbucketIntegration(projectId, true);
  if (!integration) {
    throw new HTTPException(500, { message: "Failed to load integration" });
  }
  return integration;
}

const bitbucketIntegration = apiRouter<
  BaseVariables & { workspaceId: string }
>()
  .openapi(listRepositoriesRoute, async (c) => {
    const { workspace, authType, email, accessToken } = c.req.valid("json");
    const result = await listBitbucketRepositories({
      workspace,
      credentials: {
        authType,
        accessToken,
        ...(authType === "api_token" && email ? { email } : {}),
      },
    });
    return c.json(result, 200);
  })
  .openapi(verifyRoute, async (c) => {
    const body = c.req.valid("json");
    const credentials = await resolveBitbucketCredentials(body);
    const result = await verifyBitbucketAccess({
      credentials,
      workspace: body.workspace,
      repositorySlug: body.repositorySlug,
    });
    return c.json(result, 200);
  })
  .openapi(getIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const includeWebhookSecret = await hasWorkspacePermission(c, {
      workspace: ["manage_settings"],
    });
    const integration = await getBitbucketIntegration(
      projectId,
      includeWebhookSecret,
    );
    return c.json(integration ?? null, 200);
  })
  .openapi(createIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    await createBitbucketIntegration({ projectId, ...body });
    return c.json(await loadIntegration(projectId), 200);
  })
  .openapi(updateIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const row = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "bitbucket"),
      ),
    });
    if (!row) {
      throw new HTTPException(404, { message: "Integration not found" });
    }

    if (body.isActive !== undefined) {
      await db
        .update(integrationTable)
        .set({ isActive: body.isActive, updatedAt: new Date() })
        .where(eq(integrationTable.id, row.id));
      await publishEvent("project.updated", { projectId, linksChanged: true });
    }

    return c.json(await loadIntegration(projectId), 200);
  })
  .openapi(deleteIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const result = await deleteBitbucketIntegration(projectId);
    return c.json(result, 200);
  });

export async function handleBitbucketWebhookRoute(c: Context) {
  const integrationId = c.req.param("integrationId");
  if (!integrationId) {
    return c.json({ error: "Missing integration id" }, 400);
  }

  const arrayBuffer = await c.req.arrayBuffer();
  const body = Buffer.from(arrayBuffer).toString("utf8");

  const result = await handleBitbucketWebhookRequest(
    integrationId,
    body,
    c.req.header("x-hub-signature"),
    c.req.header("x-event-key"),
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ status: "success" });
}

export default bitbucketIntegration;
