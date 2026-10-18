import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type UpdateBitbucketIntegrationRequest = InferRequestType<
  (typeof client)["bitbucket-integration"]["project"][":projectId"]["$patch"]
>["json"];

async function updateBitbucketIntegration(
  projectId: string,
  json: UpdateBitbucketIntegrationRequest,
) {
  const response = await client["bitbucket-integration"].project[
    ":projectId"
  ].$patch({
    param: { projectId },
    json,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateBitbucketIntegration;
