import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type CreateBitbucketIntegrationRequest = InferRequestType<
  (typeof client)["bitbucket-integration"]["project"][":projectId"]["$post"]
>["json"];

async function createBitbucketIntegration(
  projectId: string,
  data: CreateBitbucketIntegrationRequest,
) {
  const response = await client["bitbucket-integration"].project[
    ":projectId"
  ].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createBitbucketIntegration;
