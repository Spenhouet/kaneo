import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import {
  type BitbucketAuthType,
  type BitbucketConfig,
  defaultBitbucketConfig,
  normalizeBitbucketSlug,
  validateBitbucketConfig,
} from "../../plugins/bitbucket/config";
import {
  BitbucketApiError,
  createBitbucketClient,
} from "../../plugins/bitbucket/utils/bitbucket-api";
import { resolveBitbucketCredentials } from "./resolve-credentials";

async function createBitbucketIntegration({
  projectId,
  workspace,
  repositorySlug,
  authType,
  email,
  accessToken,
}: {
  projectId: string;
  workspace: string;
  repositorySlug: string;
  authType?: BitbucketAuthType;
  email?: string;
  accessToken?: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const normalizedWorkspace = normalizeBitbucketSlug(workspace);
  const normalizedSlug = normalizeBitbucketSlug(repositorySlug);

  const existingIntegration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "bitbucket"),
    ),
  });

  const credentials = await resolveBitbucketCredentials({
    projectId,
    authType,
    email,
    accessToken,
  });

  try {
    await createBitbucketClient(credentials).getRepository(
      normalizedWorkspace,
      normalizedSlug,
    );
  } catch (error) {
    if (error instanceof BitbucketApiError) {
      throw new HTTPException(error.status === 401 ? 401 : 400, {
        message:
          error.status === 401
            ? "Bitbucket rejected the credentials."
            : "Repository not found or not accessible with this token.",
      });
    }
    throw error;
  }

  const allBitbucket = await db.query.integrationTable.findMany({
    where: eq(integrationTable.type, "bitbucket"),
  });

  for (const integration of allBitbucket) {
    if (integration.projectId === projectId || !integration.isActive) {
      continue;
    }
    try {
      const cfg = JSON.parse(integration.config) as Partial<BitbucketConfig>;
      if (
        normalizeBitbucketSlug(cfg.workspace ?? "") === normalizedWorkspace &&
        normalizeBitbucketSlug(cfg.repositorySlug ?? "") === normalizedSlug
      ) {
        throw new HTTPException(409, {
          message: `Repository ${normalizedWorkspace}/${normalizedSlug} is already linked to another project`,
        });
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.warn(
        "Skipping invalid Bitbucket integration config during conflict check",
        { integrationId: integration.id, error },
      );
    }
  }

  // Keep the secret on reconnect so the webhook in Bitbucket keeps working.
  let webhookSecret = randomBytes(24).toString("hex");
  if (existingIntegration) {
    try {
      const previous = JSON.parse(
        existingIntegration.config,
      ) as Partial<BitbucketConfig>;
      webhookSecret = previous.webhookSecret ?? webhookSecret;
    } catch (error) {
      console.warn(
        "Failed to parse existing Bitbucket config for webhook secret",
        { integrationId: existingIntegration.id, error },
      );
    }
  }

  const config: BitbucketConfig = {
    ...defaultBitbucketConfig,
    workspace: normalizedWorkspace,
    repositorySlug: normalizedSlug,
    ...credentials,
    webhookSecret,
  };

  const validation = await validateBitbucketConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }

  if (existingIntegration) {
    const [updated] = await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(config),
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrationTable.id, existingIntegration.id),
          eq(integrationTable.config, existingIntegration.config),
        ),
      )
      .returning();

    if (!updated) {
      throw new HTTPException(409, {
        message: "Bitbucket integration changed; refresh before reconnecting",
      });
    }
    return updated;
  }

  const [created] = await db
    .insert(integrationTable)
    .values({
      projectId,
      type: "bitbucket",
      config: JSON.stringify(config),
      isActive: true,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, {
      message: "Failed to create Bitbucket integration",
    });
  }
  return created;
}

export default createBitbucketIntegration;
