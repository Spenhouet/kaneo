import {
  formatRepository,
  getIntegrationStatus,
  type IntegrationStatus,
} from "@/components/project/integrations/get-integration-status";
import {
  REPOSITORY_PROVIDERS,
  type RepositoryProvider,
} from "@/components/project/automations/repository-providers";
import useGetBitbucketIntegration from "@/hooks/queries/bitbucket-integration/use-get-bitbucket-integration";
import useGetGiteaIntegration from "@/hooks/queries/gitea-integration/use-get-gitea-integration";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";
import useGetGitlabIntegration from "@/hooks/queries/gitlab-integration/use-get-gitlab-integration";

export type RepositoryConnection = RepositoryProvider & {
  status: IntegrationStatus;
};

export function useRepositoryConnections(
  projectId: string,
): RepositoryConnection[] {
  const github = useGetGithubIntegration(projectId);
  const gitea = useGetGiteaIntegration(projectId);
  const gitlab = useGetGitlabIntegration(projectId);
  const bitbucket = useGetBitbucketIntegration(projectId);

  const statuses = {
    github: getIntegrationStatus({
      queryStatus: github.status,
      hasData: github.data !== undefined,
      configured: Boolean(github.data),
      isActive: github.data?.isActive,
      detail: formatRepository(
        github.data?.repositoryOwner,
        github.data?.repositoryName,
      ),
    }),
    gitea: getIntegrationStatus({
      queryStatus: gitea.status,
      hasData: gitea.data !== undefined,
      configured: Boolean(gitea.data),
      isActive: gitea.data?.isActive,
      detail: formatRepository(
        gitea.data?.repositoryOwner,
        gitea.data?.repositoryName,
      ),
    }),
    gitlab: getIntegrationStatus({
      queryStatus: gitlab.status,
      hasData: gitlab.data !== undefined,
      configured: Boolean(gitlab.data),
      isActive: gitlab.data?.isActive,
      detail: gitlab.data?.projectPath,
    }),
    bitbucket: getIntegrationStatus({
      queryStatus: bitbucket.status,
      hasData: bitbucket.data !== undefined,
      configured: Boolean(bitbucket.data),
      isActive: bitbucket.data?.isActive,
      detail: formatRepository(
        bitbucket.data?.workspace,
        bitbucket.data?.repositorySlug,
      ),
    }),
  };

  return REPOSITORY_PROVIDERS.map((provider) => ({
    ...provider,
    status: statuses[provider.id],
  }));
}
