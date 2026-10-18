import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type BitbucketAuthType,
  bitbucketCredentials,
} from "@/components/project/bitbucket-integration/bitbucket-access";
import { BitbucketCredentialFields } from "@/components/project/bitbucket-integration/bitbucket-credential-fields";
import { useBitbucketVerification } from "@/components/project/bitbucket-integration/use-bitbucket-verification";
import { useSaveBitbucketIntegration } from "@/components/project/bitbucket-integration/use-save-bitbucket-integration";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import { ChangeTokenForm } from "@/components/project/code-hosting/change-token-form";
import type { BitbucketIntegration } from "@/fetchers/bitbucket-integration/get-bitbucket-integration";

type BitbucketChangeTokenProps = {
  projectId: string;
  integration: BitbucketIntegration;
  onDone: () => void;
};

export function BitbucketChangeToken({
  projectId,
  integration,
  onDone,
}: BitbucketChangeTokenProps) {
  const { t } = useTranslation();
  const [authType, setAuthType] = useState<BitbucketAuthType>(
    integration.authType,
  );
  const [email, setEmail] = useState(integration.email ?? "");
  const [token, setToken] = useState("");
  const credentials = bitbucketCredentials(authType, email, token);
  const access = credentials
    ? {
        workspace: integration.workspace,
        repositorySlug: integration.repositorySlug,
        credentials,
      }
    : null;
  const verification = useBitbucketVerification(projectId, access);
  const verified = isAccessVerified(verification.result);
  const { save, saving } = useSaveBitbucketIntegration(projectId);

  return (
    <ChangeTokenForm
      token={token}
      tokenLabel={t("settings:bitbucketIntegration.tokenLabel")}
      placeholder={t("settings:bitbucketIntegration.tokenPlaceholderUpdate")}
      fallbackError={t("settings:bitbucketIntegration.toast.verifyError")}
      extra={
        <BitbucketCredentialFields
          authType={authType}
          email={email}
          disabled={saving}
          onAuthTypeChange={setAuthType}
          onEmailChange={setEmail}
        />
      }
      verification={verification}
      saving={saving}
      canSave={
        access !== null && (verification.result === undefined || verified)
      }
      onTokenChange={setToken}
      onCancel={onDone}
      onSave={async () => {
        if (access && (await save(access, verified))) onDone();
      }}
    />
  );
}
