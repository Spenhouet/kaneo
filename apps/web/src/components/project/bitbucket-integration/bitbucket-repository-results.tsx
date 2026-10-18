import { useTranslation } from "react-i18next";
import { RepositoryPickerMessage } from "@/components/project/code-hosting/picker/repository-picker-message";
import { RepositoryPickerRow } from "@/components/project/code-hosting/picker/repository-picker-row";
import { RepositoryPickerSkeleton } from "@/components/project/code-hosting/picker/repository-picker-skeleton";
import { Button } from "@/components/ui/button";
import type { ListBitbucketRepositoriesResponse } from "@/fetchers/bitbucket-integration/list-bitbucket-repositories";

type BitbucketRepository =
  ListBitbucketRepositoriesResponse["repositories"][number];

type BitbucketRepositoryResultsProps = {
  canFetch: boolean;
  isLoading: boolean;
  error: unknown;
  loaded: boolean;
  repositories: BitbucketRepository[];
  searching: boolean;
  selected: string | null;
  onSelect: (repository: BitbucketRepository) => void;
  onConfirm: (repository: BitbucketRepository) => void;
  onRetry: () => void;
};

export function BitbucketRepositoryResults({
  canFetch,
  isLoading,
  error,
  loaded,
  repositories,
  searching,
  selected,
  onSelect,
  onConfirm,
  onRetry,
}: BitbucketRepositoryResultsProps) {
  const { t } = useTranslation();

  if (!canFetch) {
    return (
      <RepositoryPickerMessage
        title={t("settings:bitbucketIntegration.browseNeedsCredentials")}
      />
    );
  }
  if (isLoading) return <RepositoryPickerSkeleton />;
  if (error) {
    return (
      <RepositoryPickerMessage
        tone="destructive"
        title={
          error instanceof Error && error.message
            ? error.message
            : t("settings:repositoryBrowser.loadError")
        }
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t("settings:codeHosting.retry")}
          </Button>
        }
      />
    );
  }
  if (!loaded) return null;
  if (repositories.length === 0) {
    return (
      <RepositoryPickerMessage
        title={
          searching
            ? t("settings:repositoryBrowser.noSearchMatchTitle")
            : t("settings:bitbucketIntegration.browseEmpty")
        }
        description={
          searching ? t("settings:repositoryBrowser.noSearchMatchHint") : null
        }
      />
    );
  }

  return (
    <ul className="space-y-0.5">
      {repositories.map((repository) => (
        <RepositoryPickerRow
          key={repository.uuid}
          name={repository.full_name}
          isPrivate={repository.private}
          selected={selected === repository.full_name}
          onSelect={() => onSelect(repository)}
          onConfirm={() => onConfirm(repository)}
        />
      ))}
    </ul>
  );
}
