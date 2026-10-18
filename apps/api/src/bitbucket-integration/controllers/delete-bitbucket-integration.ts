import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";

async function deleteBitbucketIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "bitbucket"),
    ),
  });

  if (!integration) {
    throw new HTTPException(404, {
      message: "Bitbucket integration not found",
    });
  }

  await db
    .delete(integrationTable)
    .where(
      and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "bitbucket"),
      ),
    );

  return { success: true, message: "Bitbucket integration deleted" };
}

export default deleteBitbucketIntegration;
