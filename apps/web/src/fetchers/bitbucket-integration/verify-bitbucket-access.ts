import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type VerifyBitbucketAccessRequest = InferRequestType<
  (typeof client)["bitbucket-integration"]["verify"]["$post"]
>["json"];

export type VerifyBitbucketAccessResponse = InferResponseType<
  (typeof client)["bitbucket-integration"]["verify"]["$post"],
  200
>;

async function verifyBitbucketAccess(
  data: VerifyBitbucketAccessRequest,
): Promise<VerifyBitbucketAccessResponse> {
  const response = await client["bitbucket-integration"].verify.$post({
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default verifyBitbucketAccess;
