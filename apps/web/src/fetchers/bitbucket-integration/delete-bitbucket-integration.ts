import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function deleteBitbucketIntegration(projectId: string) {
  const response = await client["bitbucket-integration"].project[
    ":projectId"
  ].$delete({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default deleteBitbucketIntegration;
