import { useQuery } from "@tanstack/react-query";
import getBitbucketIntegration from "@/fetchers/bitbucket-integration/get-bitbucket-integration";

function useGetBitbucketIntegration(
  projectId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["bitbucket-integration", projectId],
    queryFn: () => getBitbucketIntegration(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

export default useGetBitbucketIntegration;
