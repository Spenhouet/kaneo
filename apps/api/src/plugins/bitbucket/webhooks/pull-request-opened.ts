import { publishEvent } from "../../../events";
import { withIntegrationTask } from "../../github/services/integration-task-scope";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import { resolvePullRequestTask } from "../../github/services/resolve-pull-request-task";
import { updateTaskStatus } from "../../github/services/task-service";
import type { BitbucketConfig } from "../config";
import { findAllIntegrationsByBitbucketRepo } from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { repositoryFromPayload } from "../utils/webhook-repo";
import {
  asResolvablePullRequest,
  type BitbucketPullRequestPayload,
  pullRequestUrl,
} from "./pull-request";

export async function handleBitbucketPullRequestOpened(
  payload: BitbucketPullRequestPayload,
  integrationId?: string,
) {
  const { pullrequest } = payload;
  const repository = repositoryFromPayload(payload.repository);
  if (!repository || pullrequest.state !== "OPEN") return;

  const pullRequest = asResolvablePullRequest(pullrequest);
  const externalId = pullrequest.id.toString();
  const integrations = await findAllIntegrationsByBitbucketRepo(
    repository.workspace,
    repository.repositorySlug,
    integrationId,
  );

  const candidates = [];
  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    let config: BitbucketConfig;
    try {
      config = JSON.parse(integration.config) as BitbucketConfig;
    } catch (error) {
      console.error("Invalid Bitbucket config for integration", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    // Bitbucket also sends pullrequest:updated for every new commit, so an
    // already linked pull request is left alone.
    if (await findExternalLink(integration.id, "pull_request", externalId))
      return;

    const task = await resolvePullRequestTask({
      integrationId: integration.id,
      projectId: integration.projectId,
      projectSlug: integration.project.slug,
      config,
      repositoryUrl: repository.htmlUrl,
      pullRequest,
    });
    if (task) candidates.push({ integration, config, task });
  }

  const candidate = candidates[0];
  if (candidates.length !== 1 || !candidate) return;
  const { integration, config, task } = candidate;

  await withIntegrationTask(
    task.id,
    integration,
    async (database, afterCommit) => {
      const currentTask = await resolvePullRequestTask({
        integrationId: integration.id,
        projectId: integration.projectId,
        projectSlug: integration.project.slug,
        config,
        repositoryUrl: repository.htmlUrl,
        pullRequest,
        database,
      });
      if (currentTask?.id !== task.id) return;
      if (
        await findExternalLink(
          integration.id,
          "pull_request",
          externalId,
          database,
        )
      )
        return;
      await createExternalLink(
        {
          taskId: task.id,
          integrationId: integration.id,
          resourceType: "pull_request",
          externalId,
          url: pullRequestUrl(pullrequest, repository.htmlUrl),
          title: pullrequest.title,
          metadata: {
            state: "open",
            draft: pullrequest.draft ?? false,
            merged: false,
            branch: pullRequest.head.ref,
            author:
              pullrequest.author?.display_name ?? pullrequest.author?.nickname,
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

      const targetStatus = await resolveTargetStatus(
        integration.projectId,
        "pr_opened",
        config.statusTransitions?.onPROpen || "in-review",
        database,
      );

      if (currentTask.status !== targetStatus) {
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
      }
    },
  );
}
