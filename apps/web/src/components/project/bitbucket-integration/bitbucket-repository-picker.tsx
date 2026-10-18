import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BitbucketCredentials } from "@/components/project/bitbucket-integration/bitbucket-access";
import { BitbucketRepositoryResults } from "@/components/project/bitbucket-integration/bitbucket-repository-results";
import { filterByName } from "@/components/project/code-hosting/picker/filter-by-name";
import { RepositoryPickerDialog } from "@/components/project/code-hosting/picker/repository-picker-dialog";
import { RepositoryPickerSearch } from "@/components/project/code-hosting/picker/repository-picker-search";
import listBitbucketRepositories, {
  type ListBitbucketRepositoriesResponse,
} from "@/fetchers/bitbucket-integration/list-bitbucket-repositories";
import { authClient } from "@/lib/auth-client";

type BitbucketRepository =
  ListBitbucketRepositoriesResponse["repositories"][number];

type BitbucketRepositoryPickerProps = {
  open: boolean;
  projectId: string;
  workspace: string;
  credentials: BitbucketCredentials;
  onOpenChange: (open: boolean) => void;
  onSelectRepository: (repository: { workspace: string; slug: string }) => void;
  selectedRepository?: string;
};

export function BitbucketRepositoryPicker({
  open,
  projectId,
  workspace,
  credentials,
  onOpenChange,
  onSelectRepository,
  selectedRepository,
}: BitbucketRepositoryPickerProps) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<BitbucketRepository | null>(null);
  const { data: session } = authClient.useSession();
  const { authType, email, accessToken } = credentials;
  // A fresh id per credential keeps the token itself out of the query key.
  const request = useMemo(
    () => ({
      credentials: { authType, email, accessToken },
      cacheId: crypto.randomUUID(),
    }),
    [authType, email, accessToken],
  );
  const canFetch = open && Boolean(session?.user.id) && workspace !== "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "bitbucket-repositories",
      session?.user.id,
      projectId,
      workspace,
      request.cacheId,
    ],
    queryFn: () =>
      listBitbucketRepositories({
        projectId,
        workspace,
        ...request.credentials,
      }),
    enabled: canFetch,
    gcTime: 0,
    placeholderData: () => undefined,
  });

  const repositories = filterByName(
    data?.repositories ?? [],
    term,
    (repository) => repository.full_name,
  );
  const chosen =
    selected ??
    data?.repositories.find(
      (repository) => repository.full_name === selectedRepository,
    ) ??
    null;

  const changeOpen = (next: boolean) => {
    if (!next) {
      setTerm("");
      setSelected(null);
    }
    onOpenChange(next);
  };

  const use = (repository: BitbucketRepository | null) => {
    if (!repository) return;
    onSelectRepository({
      workspace: repository.workspace,
      slug: repository.slug,
    });
    changeOpen(false);
  };

  return (
    <RepositoryPickerDialog
      open={open}
      onOpenChange={changeOpen}
      title={t("settings:codeHosting.chooseRepositoryTitle")}
      description={t("settings:bitbucketIntegration.browseModalHint", {
        workspace,
      })}
      search={
        <RepositoryPickerSearch
          value={term}
          placeholder={t("settings:repositoryBrowser.searchPlaceholder")}
          onChange={setTerm}
        />
      }
      confirmLabel={t("settings:repositoryBrowser.useRepository")}
      confirmDisabled={!chosen || !canFetch}
      onConfirm={() => use(chosen)}
    >
      <BitbucketRepositoryResults
        canFetch={canFetch}
        isLoading={isLoading}
        error={canFetch ? error : null}
        loaded={canFetch && Boolean(data)}
        repositories={repositories}
        searching={term.trim() !== ""}
        selected={chosen?.full_name ?? null}
        onSelect={setSelected}
        onConfirm={use}
        onRetry={() => void refetch()}
      />
    </RepositoryPickerDialog>
  );
}
