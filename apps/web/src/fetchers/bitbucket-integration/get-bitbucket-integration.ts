import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getBitbucketIntegration(projectId: string) {
  const response = await client["bitbucket-integration"].project[
    ":projectId"
  ].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();
  return data;
}

export type BitbucketIntegration = NonNullable<
  Awaited<ReturnType<typeof getBitbucketIntegration>>
>;

export default getBitbucketIntegration;
