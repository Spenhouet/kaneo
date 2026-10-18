import { useTranslation } from "react-i18next";
import type { BitbucketAccess } from "@/components/project/bitbucket-integration/bitbucket-access";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import {
  useCreateBitbucketIntegration,
  useVerifyBitbucketAccess,
} from "@/hooks/mutations/bitbucket-integration/use-create-bitbucket-integration";
import { toast } from "@/lib/toast";

export function useSaveBitbucketIntegration(projectId: string) {
  const { t } = useTranslation();
  const { mutateAsync: verify, isPending: isVerifying } =
    useVerifyBitbucketAccess();
  const { mutateAsync: create, isPending: isCreating } =
    useCreateBitbucketIntegration();

  const save = async (access: BitbucketAccess, alreadyVerified: boolean) => {
    const repository = {
      workspace: access.workspace,
      repositorySlug: access.repositorySlug,
      ...access.credentials,
    };
    try {
      if (access.credentials && !alreadyVerified) {
        const verification = await verify({ projectId, ...repository });
        if (!isAccessVerified(verification)) {
          toast.error(t("settings:bitbucketIntegration.toast.verifyFirst"));
          return false;
        }
      }
      await create({ projectId, data: repository });
      toast.success(t("settings:bitbucketIntegration.toast.updated"));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:bitbucketIntegration.toast.updateError"),
      );
      return false;
    }
  };

  return { save, saving: isVerifying || isCreating };
}
