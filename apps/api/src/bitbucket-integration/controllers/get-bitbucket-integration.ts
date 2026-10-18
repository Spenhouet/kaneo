import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  type BitbucketConfig,
  defaultBitbucketConfig,
} from "../../plugins/bitbucket/config";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "••••••••";
  }
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

async function getBitbucketIntegration(
  projectId: string,
  includeWebhookSecret = false,
) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "bitbucket"),
    ),
  });

  if (!integration) {
    return null;
  }

  const config = JSON.parse(integration.config) as BitbucketConfig;

  const apiBase = normalizeApiServerUrl(
    process.env.KANEO_API_URL || "http://localhost:1337",
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    workspace: config.workspace,
    repositorySlug: config.repositorySlug,
    authType: config.authType,
    ...(config.email ? { email: config.email } : {}),
    maskedAccessToken: maskToken(config.accessToken),
    webhookUrl: `${apiBase.replace(/\/$/, "")}/bitbucket-integration/webhook/${integration.id}`,
    webhookSecret: includeWebhookSecret ? (config.webhookSecret ?? "") : "",
    branchPattern: config.branchPattern || defaultBitbucketConfig.branchPattern,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default getBitbucketIntegration;
