import { BitbucketConnectedPanel } from "@/components/project/bitbucket-integration/bitbucket-connected-panel";
import { BitbucketSetupPanel } from "@/components/project/bitbucket-integration/bitbucket-setup-panel";
import { CodeHostingLoadError } from "@/components/project/code-hosting/code-hosting-load-error";
import { CodeHostingPanelSkeleton } from "@/components/project/code-hosting/code-hosting-panel-skeleton";
import useGetBitbucketIntegration from "@/hooks/queries/bitbucket-integration/use-get-bitbucket-integration";

type BitbucketIntegrationSettingsProps = {
  projectId: string;
};

export function BitbucketIntegrationSettings({
  projectId,
}: BitbucketIntegrationSettingsProps) {
  const {
    data: integration,
    isLoading,
    error,
    refetch,
  } = useGetBitbucketIntegration(projectId);

  if (isLoading) return <CodeHostingPanelSkeleton />;
  if (error && !integration)
    return (
      <CodeHostingLoadError error={error} onRetry={() => void refetch()} />
    );
  if (!integration) return <BitbucketSetupPanel projectId={projectId} />;

  return (
    <BitbucketConnectedPanel projectId={projectId} integration={integration} />
  );
}
