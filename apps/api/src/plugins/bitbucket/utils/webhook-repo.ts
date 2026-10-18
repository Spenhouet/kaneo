export type BitbucketWebhookRepository = {
  full_name: string;
  name?: string;
  links?: { html?: { href?: string } };
};

// full_name is "<workspace>/<repository slug>" in webhook payloads.
export function repositoryFromPayload(repository: BitbucketWebhookRepository) {
  const [workspace = "", repositorySlug = ""] = repository.full_name.split("/");
  if (!workspace || !repositorySlug) return null;
  return {
    workspace,
    repositorySlug,
    htmlUrl:
      repository.links?.html?.href ??
      `https://bitbucket.org/${workspace}/${repositorySlug}`,
  };
}
