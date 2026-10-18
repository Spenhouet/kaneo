import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type ListBitbucketRepositoriesRequest = InferRequestType<
  (typeof client)["bitbucket-integration"]["repositories"]["$post"]
>["json"];

export type ListBitbucketRepositoriesResponse = InferResponseType<
  (typeof client)["bitbucket-integration"]["repositories"]["$post"],
  200
>;

async function listBitbucketRepositories(
  data: ListBitbucketRepositoriesRequest,
): Promise<ListBitbucketRepositoriesResponse> {
  const response = await client["bitbucket-integration"].repositories.$post({
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default listBitbucketRepositories;
