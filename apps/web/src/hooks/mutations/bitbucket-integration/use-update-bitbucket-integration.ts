import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateBitbucketIntegration, {
  type UpdateBitbucketIntegrationRequest,
} from "@/fetchers/bitbucket-integration/update-bitbucket-integration";

export function useUpdateBitbucketIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateBitbucketIntegrationRequest;
    }) => updateBitbucketIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["bitbucket-integration", projectId],
      });
    },
  });
}
