import { useMutation, useQueryClient } from "@tanstack/react-query";
import createBitbucketIntegration, {
  type CreateBitbucketIntegrationRequest,
} from "@/fetchers/bitbucket-integration/create-bitbucket-integration";
import deleteBitbucketIntegration from "@/fetchers/bitbucket-integration/delete-bitbucket-integration";
import verifyBitbucketAccess, {
  type VerifyBitbucketAccessRequest,
} from "@/fetchers/bitbucket-integration/verify-bitbucket-access";

export function useCreateBitbucketIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateBitbucketIntegrationRequest;
    }) => createBitbucketIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["bitbucket-integration", projectId],
      });
    },
  });
}

export function useDeleteBitbucketIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteBitbucketIntegration(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: ["bitbucket-integration", projectId],
      });
    },
  });
}

export function useVerifyBitbucketAccess() {
  return useMutation({
    mutationFn: (data: VerifyBitbucketAccessRequest) =>
      verifyBitbucketAccess(data),
  });
}
