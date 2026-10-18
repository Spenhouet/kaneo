import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import {
  findTaskById,
  updateTaskStatus,
} from "../../github/services/task-service";
import { withIntegrationLink } from "../../github/services/with-integration-link";
import type { BitbucketConfig } from "../config";
import { findAllIntegrationsByBitbucketRepo } from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { repositoryFromPayload } from "../utils/webhook-repo";
import type { BitbucketPullRequestPayload } from "./pull-request";

// Handles pullrequest:fulfilled (merged) and pullrequest:rejected (declined).
export async function handleBitbucketPullRequestClosed(
  payload: BitbucketPullRequestPayload,
  integrationId?: string,
) {
  const { pullrequest } = payload;
  const repository = repositoryFromPayload(payload.repository);
  if (!repository) return;

  const merged = pullrequest.state === "MERGED";
  const integrations = await findAllIntegrationsByBitbucketRepo(
    repository.workspace,
    repository.repositorySlug,
    integrationId,
  );

  for (const integration of integrations) {
    let config: BitbucketConfig;
    try {
      config = JSON.parse(integration.config) as BitbucketConfig;
    } catch {
      continue;
    }

    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "pull_request"),
        eq(externalLinkTable.externalId, pullrequest.id.toString()),
      ),
    });

    if (!externalLink) {
      continue;
    }

    await withIntegrationLink(
      externalLink,
      integration,
      async (database, afterCommit, lockedLink) => {
        const task = await findTaskById(externalLink.taskId, database);
        if (!task) {
          return;
        }

        const existingMetadata = lockedLink.metadata
          ? JSON.parse(lockedLink.metadata)
          : {};

        await updateExternalLink(
          externalLink.id,
          {
            title: pullrequest.title,
            metadata: {
              ...existingMetadata,
              state: "closed",
              merged,
            },
          },
          database,
        );

        afterCommit(() =>
          publishEvent("task.updated", {
            projectId: integration.projectId,
            taskId: task.id,
          }),
        );

        if (!merged) {
          return;
        }

        const allTaskPRs = await database.query.externalLinkTable.findMany({
          where: and(
            eq(externalLinkTable.taskId, task.id),
            eq(externalLinkTable.resourceType, "pull_request"),
          ),
        });
        const hasOpenPRs = allTaskPRs.some((pr) => {
          if (pr.id === externalLink.id) return false;
          const metadata = pr.metadata ? JSON.parse(pr.metadata) : {};
          return metadata.state === "open";
        });
        if (hasOpenPRs) {
          return;
        }

        const targetStatus = await resolveTargetStatus(
          integration.projectId,
          "pr_merged",
          config.statusTransitions?.onPRMerge || "done",
          database,
        );
        const statusResult = await updateTaskStatus(
          task.id,
          targetStatus,
          database,
        );
        if (
          statusResult.applied &&
          statusResult.before.status !== statusResult.after.status
        ) {
          afterCommit(() =>
            publishEvent("task.status_changed", {
              taskId: statusResult.after.id,
              projectId: statusResult.after.projectId,
              userId: null,
              oldStatus: statusResult.before.status,
              newStatus: statusResult.after.status,
              title: statusResult.after.title,
              assigneeId: statusResult.after.userId,
              type: "status_changed",
            }),
          );
        }
      },
    );

    return;
  }
}
