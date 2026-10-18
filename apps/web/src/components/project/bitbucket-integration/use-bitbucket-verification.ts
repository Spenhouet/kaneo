import {
  type BitbucketAccess,
  bitbucketAccessKey,
} from "@/components/project/bitbucket-integration/bitbucket-access";
import { useDebouncedCheck } from "@/components/project/code-hosting/use-debounced-check";
import { useVerifyBitbucketAccess } from "@/hooks/mutations/bitbucket-integration/use-create-bitbucket-integration";

export function useBitbucketVerification(
  projectId: string,
  access: BitbucketAccess | null,
) {
  const { mutateAsync: verify } = useVerifyBitbucketAccess();

  return useDebouncedCheck(access ? bitbucketAccessKey(access) : null, () => {
    if (!access) throw new Error("Missing Bitbucket access");
    return verify({
      projectId,
      workspace: access.workspace,
      repositorySlug: access.repositorySlug,
      ...access.credentials,
    });
  });
}
