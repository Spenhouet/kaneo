import type { BitbucketWebhookRepository } from "../utils/webhook-repo";

export type BitbucketPullRequest = {
  id: number;
  title: string;
  description?: string | null;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED" | string;
  draft?: boolean;
  author?: { display_name?: string; nickname?: string } | null;
  source: { branch: { name: string } };
  links?: { html?: { href?: string } };
};

export type BitbucketPullRequestPayload = {
  pullrequest: BitbucketPullRequest;
  repository: BitbucketWebhookRepository;
};

export function pullRequestUrl(
  pullRequest: BitbucketPullRequest,
  repositoryUrl: string,
) {
  return (
    pullRequest.links?.html?.href ??
    `${repositoryUrl}/pull-requests/${pullRequest.id}`
  );
}

// The shared task resolver expects the GitHub field names.
export function asResolvablePullRequest(pullRequest: BitbucketPullRequest) {
  return {
    number: pullRequest.id,
    title: pullRequest.title,
    body: pullRequest.description ?? null,
    head: { ref: pullRequest.source.branch.name },
  };
}
