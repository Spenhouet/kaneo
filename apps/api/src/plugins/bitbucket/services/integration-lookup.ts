import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { integrationTable } from "../../../database/schema";
import { type BitbucketConfig, normalizeBitbucketSlug } from "../config";

export async function findAllIntegrationsByBitbucketRepo(
  workspace: string,
  repositorySlug: string,
  integrationId?: string,
) {
  const conditions = [
    eq(integrationTable.type, "bitbucket"),
    eq(integrationTable.isActive, true),
  ];
  if (integrationId) {
    conditions.push(eq(integrationTable.id, integrationId));
  }

  const integrations = await db.query.integrationTable.findMany({
    where: and(...conditions),
    with: {
      project: true,
    },
  });

  const wantedWorkspace = normalizeBitbucketSlug(workspace);
  const wantedSlug = normalizeBitbucketSlug(repositorySlug);

  return integrations.filter((integration) => {
    try {
      const config = JSON.parse(integration.config) as BitbucketConfig;
      const matches =
        normalizeBitbucketSlug(config.workspace) === wantedWorkspace &&
        normalizeBitbucketSlug(config.repositorySlug) === wantedSlug;
      if (integrationId && !matches) {
        console.warn(
          "[Bitbucket Webhook] Signed integration repository mismatch",
          { integrationId },
        );
      }
      return matches;
    } catch {
      return false;
    }
  });
}
