import { HTTPException } from "hono/http-exception";
import type { BitbucketCredentials } from "../../plugins/bitbucket/config";
import {
  BitbucketApiError,
  createBitbucketClient,
} from "../../plugins/bitbucket/utils/bitbucket-api";

async function listBitbucketRepositories({
  credentials,
  workspace,
}: {
  credentials: BitbucketCredentials;
  workspace: string;
}) {
  try {
    const repositories =
      await createBitbucketClient(credentials).listRepositories(workspace);
    return {
      repositories: repositories.map((repository) => ({
        uuid: repository.uuid,
        slug: repository.slug,
        name: repository.name,
        full_name: repository.full_name,
        workspace: repository.workspace?.slug ?? workspace,
        private: repository.is_private,
        html_url:
          repository.links?.html?.href ??
          `https://bitbucket.org/${repository.full_name}`,
      })),
    };
  } catch (error) {
    if (
      error instanceof BitbucketApiError &&
      [401, 403, 404].includes(error.status)
    ) {
      throw new HTTPException(400, {
        message:
          "Could not list repositories. Check the workspace, the token and its scopes.",
      });
    }
    throw error;
  }
}

export default listBitbucketRepositories;
