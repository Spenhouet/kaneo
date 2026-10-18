import { useTranslation } from "react-i18next";
import { BitbucketChangeToken } from "@/components/project/bitbucket-integration/bitbucket-change-token";
import { AccessStatusLine } from "@/components/project/code-hosting/access-status-line";
import type { AccessVerificationResult } from "@/components/project/code-hosting/access-verification-tone";
import { RepositoryLink } from "@/components/project/code-hosting/repository-link";
import { StoredTokenRow } from "@/components/project/code-hosting/stored-token-row";
import { IntegrationCheckLine } from "@/components/project/integrations/panel/integration-check-line";
import { IntegrationPanelSection } from "@/components/project/integrations/panel/integration-panel-section";
import { Button } from "@/components/ui/button";
import type { BitbucketIntegration } from "@/fetchers/bitbucket-integration/get-bitbucket-integration";

type BitbucketRepositorySectionProps = {
  projectId: string;
  integration: BitbucketIntegration;
  status: {
    checking: boolean;
    result: AccessVerificationResult | undefined;
    error: unknown;
  };
  editingToken: boolean;
  reconnecting: boolean;
  onEditingTokenChange: (editing: boolean) => void;
  onReconnect: () => void;
};

export function BitbucketRepositorySection({
  projectId,
  integration,
  status,
  editingToken,
  reconnecting,
  onEditingTokenChange,
  onReconnect,
}: BitbucketRepositorySectionProps) {
  const { t } = useTranslation();
  const isConnected = Boolean(integration.isActive);
  const name = `${integration.workspace}/${integration.repositorySlug}`;

  return (
    <IntegrationPanelSection
      label={t("settings:codeHosting.repositorySection")}
    >
      <div className="min-w-0 space-y-1">
        <RepositoryLink name={name} href={`https://bitbucket.org/${name}`} />
        {isConnected ? (
          <AccessStatusLine
            {...status}
            fallbackError={t("settings:bitbucketIntegration.toast.verifyError")}
          />
        ) : null}
      </div>
      {isConnected ? null : (
        <IntegrationCheckLine
          tone="warning"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={reconnecting}
              onClick={onReconnect}
            >
              {t("settings:codeHosting.reconnect")}
            </Button>
          }
        >
          {t("settings:codeHosting.pausedHint")}
        </IntegrationCheckLine>
      )}
      <StoredTokenRow
        maskedToken={integration.maskedAccessToken}
        editing={editingToken}
        onEdit={() => onEditingTokenChange(true)}
      />
      {editingToken ? (
        <BitbucketChangeToken
          projectId={projectId}
          integration={integration}
          onDone={() => onEditingTokenChange(false)}
        />
      ) : null}
    </IntegrationPanelSection>
  );
}
