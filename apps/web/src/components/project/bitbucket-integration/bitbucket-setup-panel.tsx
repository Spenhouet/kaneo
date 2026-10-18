import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BITBUCKET_SLUG_PATTERN,
  type BitbucketAuthType,
  bitbucketCredentials,
  workspaceFromPath,
} from "@/components/project/bitbucket-integration/bitbucket-access";
import { BitbucketRepositoryPicker } from "@/components/project/bitbucket-integration/bitbucket-repository-picker";
import { BitbucketSignInStep } from "@/components/project/bitbucket-integration/bitbucket-sign-in-step";
import { useBitbucketVerification } from "@/components/project/bitbucket-integration/use-bitbucket-verification";
import { useSaveBitbucketIntegration } from "@/components/project/bitbucket-integration/use-save-bitbucket-integration";
import { AccessVerificationLine } from "@/components/project/code-hosting/access-verification-line";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import {
  formatRepositoryPath,
  parseRepositoryPath,
} from "@/components/project/code-hosting/parse-repository-path";
import { RepositoryChoiceStep } from "@/components/project/code-hosting/repository-choice-step";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { IntegrationSteps } from "@/components/project/integrations/panel/integration-steps";
import { Button } from "@/components/ui/button";

type BitbucketSetupPanelProps = {
  projectId: string;
};

export function BitbucketSetupPanel({ projectId }: BitbucketSetupPanelProps) {
  const { t } = useTranslation();
  const [authType, setAuthType] = useState<BitbucketAuthType>("api_token");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [path, setPath] = useState("");
  const [touched, setTouched] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const { save, saving } = useSaveBitbucketIntegration(projectId);

  const credentials = bitbucketCredentials(authType, email, token);
  const repository = parseRepositoryPath(path, BITBUCKET_SLUG_PATTERN);
  const workspace = workspaceFromPath(path);
  const access =
    credentials && repository
      ? {
          workspace: repository.owner,
          repositorySlug: repository.name,
          credentials,
        }
      : null;
  const verification = useBitbucketVerification(projectId, access);
  const verified = isAccessVerified(verification.result);
  const blocked = verification.result !== undefined && !verified;
  const pathInvalid = touched && path.trim() !== "" && !repository;

  return (
    <>
      <IntegrationPanel>
        <IntegrationSteps>
          <BitbucketSignInStep
            authType={authType}
            email={email}
            token={token}
            disabled={saving}
            onAuthTypeChange={setAuthType}
            onEmailChange={setEmail}
            onTokenChange={setToken}
          />
          <RepositoryChoiceStep
            title={t("settings:codeHosting.chooseRepositoryTitle")}
            description={t(
              "settings:bitbucketIntegration.chooseRepositoryDescription",
            )}
            inputLabel={t("settings:codeHosting.repositoryPathLabel")}
            placeholder="workspace/repository"
            value={path}
            invalidMessage={
              pathInvalid
                ? t("settings:bitbucketIntegration.repositoryPathInvalid")
                : null
            }
            disabled={saving}
            browseDisabled={!credentials || !workspace}
            status={
              <AccessVerificationLine
                {...verification}
                fallbackError={t(
                  "settings:bitbucketIntegration.toast.verifyError",
                )}
              />
            }
            onChange={setPath}
            onBlur={() => setTouched(true)}
            onBrowse={() => setBrowsing(true)}
          />
        </IntegrationSteps>
        <IntegrationPanelFooter>
          <Button
            type="button"
            loading={saving}
            disabled={!access || blocked}
            onClick={() => {
              if (access) void save(access, verified);
            }}
          >
            {t("settings:codeHosting.connectRepository")}
          </Button>
        </IntegrationPanelFooter>
      </IntegrationPanel>
      {credentials ? (
        <BitbucketRepositoryPicker
          open={browsing}
          projectId={projectId}
          workspace={workspace}
          credentials={credentials}
          onOpenChange={setBrowsing}
          onSelectRepository={(selected) => {
            setPath(formatRepositoryPath(selected.workspace, selected.slug));
            setTouched(true);
          }}
          selectedRepository={
            repository
              ? formatRepositoryPath(repository.owner, repository.name)
              : undefined
          }
        />
      ) : null}
    </>
  );
}
