import { HTTPException } from "hono/http-exception";
import type { BitbucketCredentials } from "../../plugins/bitbucket/config";
import {
  BitbucketApiError,
  createBitbucketClient,
} from "../../plugins/bitbucket/utils/bitbucket-api";

function failure(
  failureReason: "invalid_credentials" | "repository_not_found",
  message: string,
) {
  return {
    isInstalled: false,
    hasRequiredPermissions: false,
    repositoryExists: false,
    repositoryPrivate: null,
    missingPermissions: [] as string[],
    message,
    failureReason,
  };
}

async function verifyBitbucketAccess({
  credentials,
  workspace,
  repositorySlug,
}: {
  credentials: BitbucketCredentials;
  workspace: string;
  repositorySlug: string;
}) {
  const client = createBitbucketClient(credentials);

  try {
    const repository = await client.getRepository(workspace, repositorySlug);
    const canReadPullRequests = await client.canReadPullRequests(
      workspace,
      repositorySlug,
    );

    return {
      isInstalled: true,
      hasRequiredPermissions: canReadPullRequests,
      repositoryExists: true,
      repositoryPrivate: repository.is_private,
      missingPermissions: canReadPullRequests ? [] : ["pull requests (read)"],
      message: canReadPullRequests
        ? "Token can access the repository."
        : "Token can read the repository but not its pull requests.",
      failureReason: null,
    };
  } catch (error) {
    if (error instanceof BitbucketApiError) {
      if (error.status === 401) {
        return failure(
          "invalid_credentials",
          "Bitbucket rejected the credentials. Check the token and, for an API token, the email address.",
        );
      }
      if (error.status === 403 || error.status === 404) {
        return failure(
          "repository_not_found",
          "Repository not found or not accessible with this token.",
        );
      }
    }

    throw new HTTPException(500, {
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify Bitbucket access",
    });
  }
}

export default verifyBitbucketAccess;
