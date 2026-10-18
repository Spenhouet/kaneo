import { publishEvent } from "../../../events";
import {
  linkedTaskScope,
  withIntegrationTask,
} from "../../github/services/integration-task-scope";
import { createOrUpdateExternalLink } from "../../github/services/link-manager";
import {
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import { extractTaskNumberFromBranch } from "../../github/utils/branch-matcher";
import type { BitbucketConfig } from "../config";
import { findAllIntegrationsByBitbucketRepo } from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import {
  type BitbucketWebhookRepository,
  repositoryFromPayload,
} from "../utils/webhook-repo";

type BitbucketCommit = {
  hash: string;
  message?: string;
  date?: string;
  author?: { raw?: string; user?: { display_name?: string } };
};

export type BitbucketPushPayload = {
  repository: BitbucketWebhookRepository;
  push: {
    changes: Array<{
      new: {
        type: string;
        name: string;
        target?: BitbucketCommit;
      } | null;
      closed?: boolean;
    }>;
  };
};

const PROTECTED_BRANCHES = [
  "main",
  "master",
  "develop",
  "staging",
  "production",
];

function commitAuthor(commit: BitbucketCommit) {
  return commit.author?.user?.display_name ?? commit.author?.raw;
}

export async function handleBitbucketPush(
  payload: BitbucketPushPayload,
  integrationId?: string,
) {
  const repository = repositoryFromPayload(payload.repository);
  if (!repository) return;

  // One push can update several branches. Deleted branches and tags carry no
  // work to link.
  const branches = payload.push.changes.flatMap((change) =>
    change.new && change.new.type === "branch" && !change.closed
      ? [change.new]
      : [],
  );

  for (const branch of branches) {
    if (PROTECTED_BRANCHES.includes(branch.name)) {
      console.log(`[Bitbucket Push] Skipping protected branch: ${branch.name}`);
      continue;
    }
    await linkBranch(repository, branch, integrationId);
  }
}

async function linkBranch(
  repository: NonNullable<ReturnType<typeof repositoryFromPayload>>,
  branch: { name: string; target?: BitbucketCommit },
  integrationId?: string,
) {
  const integrations = await findAllIntegrationsByBitbucketRepo(
    repository.workspace,
    repository.repositorySlug,
    integrationId,
  );

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    let config: BitbucketConfig;
    try {
      config = JSON.parse(integration.config) as BitbucketConfig;
    } catch (error) {
      console.error("Invalid Bitbucket integration config for push webhook", {
        integrationId: integration.id,
        error,
      });
      continue;
    }

    const taskNumber = extractTaskNumberFromBranch(
      branch.name,
      config,
      integration.project.slug,
    );
    if (!taskNumber) {
      continue;
    }

    const task = await findTaskByNumber(integration.projectId, taskNumber);
    if (!task) {
      continue;
    }

    const branchUrl = `${repository.htmlUrl}/branch/${encodeURIComponent(branch.name)}`;
    const headCommit = branch.target;
    const taskId = task.id;

    await withIntegrationTask(
      taskId,
      integration,
      async (database, afterCommit) => {
        const current = await database.query.taskTable.findFirst({
          where: linkedTaskScope(taskId, integration.projectId),
        });
        if (!current) return;

        const branchLink = await createOrUpdateExternalLink(
          {
            taskId: current.id,
            integrationId: integration.id,
            resourceType: "branch",
            externalId: branch.name,
            url: branchUrl,
            title: branch.name,
            metadata: {
              lastCommit: headCommit
                ? {
                    sha: headCommit.hash,
                    message: headCommit.message ?? "",
                    author: commitAuthor(headCommit),
                    timestamp: headCommit.date,
                  }
                : null,
            },
          },
          database,
        );

        const targetStatus = await resolveTargetStatus(
          integration.projectId,
          "branch_push",
          config.statusTransitions?.onBranchPush || "in-progress",
          database,
        );

        const canMove =
          branchLink.created || !(await isTaskInFinalState(current, database));

        if (current.status !== targetStatus && canMove) {
          const statusResult = await updateTaskStatus(
            current.id,
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
        afterCommit(() =>
          publishEvent("task.updated", {
            projectId: integration.projectId,
            taskId: current.id,
          }),
        );
      },
    );
  }
}
