import { UnplugIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BitbucketRepositorySection } from "@/components/project/bitbucket-integration/bitbucket-repository-section";
import { useBitbucketVerification } from "@/components/project/bitbucket-integration/use-bitbucket-verification";
import { useSaveBitbucketIntegration } from "@/components/project/bitbucket-integration/use-save-bitbucket-integration";
import { DisconnectIntegrationButton } from "@/components/project/code-hosting/disconnect-integration-button";
import { WebhookSection } from "@/components/project/code-hosting/webhook-section";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import type { BitbucketIntegration } from "@/fetchers/bitbucket-integration/get-bitbucket-integration";
import { useDeleteBitbucketIntegration } from "@/hooks/mutations/bitbucket-integration/use-create-bitbucket-integration";
import { toast } from "@/lib/toast";

type BitbucketConnectedPanelProps = {
  projectId: string;
  integration: BitbucketIntegration;
};

export function BitbucketConnectedPanel({
  projectId,
  integration,
}: BitbucketConnectedPanelProps) {
  const { t } = useTranslation();
  const [editingToken, setEditingToken] = useState(false);
  const isConnected = Boolean(integration.isActive);
  const savedAccess = {
    workspace: integration.workspace,
    repositorySlug: integration.repositorySlug,
  };
  const status = useBitbucketVerification(
    projectId,
    isConnected && !editingToken ? savedAccess : null,
  );
  const { save, saving } = useSaveBitbucketIntegration(projectId);
  const { mutateAsync: remove, isPending: isDeleting } =
    useDeleteBitbucketIntegration();
  const target = `${integration.workspace}/${integration.repositorySlug}`;

  const disconnect = async () => {
    try {
      await remove(projectId);
      toast.success(t("settings:bitbucketIntegration.toast.removed"), {
        icon: UnplugIcon,
      });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:bitbucketIntegration.toast.removeError"),
      );
      return false;
    }
  };

  return (
    <IntegrationPanel>
      <BitbucketRepositorySection
        projectId={projectId}
        integration={integration}
        status={status}
        editingToken={editingToken}
        reconnecting={saving}
        onEditingTokenChange={setEditingToken}
        onReconnect={() => void save(savedAccess, false)}
      />
      <WebhookSection
        url={integration.webhookUrl}
        secret={integration.webhookSecret}
        description={t("settings:bitbucketIntegration.webhookHint")}
        events={t("settings:bitbucketIntegration.webhookEvents")}
      />
      <IntegrationPanelFooter>
        <DisconnectIntegrationButton
          provider="Bitbucket"
          target={target}
          pending={isDeleting || saving}
          onConfirm={disconnect}
        />
      </IntegrationPanelFooter>
    </IntegrationPanel>
  );
}
