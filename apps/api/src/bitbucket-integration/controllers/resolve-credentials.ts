import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type {
  BitbucketAuthType,
  BitbucketConfig,
  BitbucketCredentials,
} from "../../plugins/bitbucket/config";

// New credentials win. Without a token the project's saved credentials are
// used; they only ever go to the fixed Bitbucket Cloud API host.
export async function resolveBitbucketCredentials(input: {
  projectId: string;
  authType?: BitbucketAuthType;
  email?: string;
  accessToken?: string;
}): Promise<BitbucketCredentials> {
  const accessToken = input.accessToken?.trim();
  if (accessToken) {
    const authType = input.authType ?? "api_token";
    const email = input.email?.trim();
    if (authType === "api_token" && !email) {
      throw new HTTPException(400, {
        message: "Enter the email address of the Atlassian account.",
      });
    }
    return {
      authType,
      accessToken,
      ...(authType === "api_token" ? { email } : {}),
    };
  }

  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, input.projectId),
      eq(integrationTable.type, "bitbucket"),
    ),
  });
  let config: Partial<BitbucketConfig> | null = null;
  try {
    config = integration ? JSON.parse(integration.config) : null;
  } catch {
    throw new HTTPException(400, {
      message:
        "Invalid saved Bitbucket configuration. Reconnect the integration.",
    });
  }
  if (!config?.accessToken || !config.authType) {
    throw new HTTPException(400, {
      message: "Enter a token to verify this Bitbucket repository.",
    });
  }
  return {
    authType: config.authType,
    accessToken: config.accessToken,
    ...(config.email ? { email: config.email } : {}),
  };
}
