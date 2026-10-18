import * as v from "valibot";
import { branchPatterns } from "../github/config";

export { branchPatterns };

export const bitbucketAuthTypes = ["api_token", "access_token"] as const;

export type BitbucketAuthType = (typeof bitbucketAuthTypes)[number];

// Workspace and repository slugs are lowercase in Bitbucket Cloud URLs and
// webhook payloads, so they are stored that way to compare them directly.
const slug = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.nonEmpty());

export const bitbucketConfigSchema = v.pipe(
  v.object({
    workspace: slug,
    repositorySlug: slug,
    // api_token: an Atlassian API token sent with the account email (Basic).
    // access_token: a repository, project or workspace access token (Bearer).
    authType: v.picklist(bitbucketAuthTypes),
    email: v.optional(v.pipe(v.string(), v.trim(), v.email())),
    accessToken: v.pipe(v.string(), v.trim(), v.nonEmpty()),
    webhookSecret: v.optional(v.string()),
    branchPattern: v.optional(v.string()),
    customBranchRegex: v.optional(v.string()),
    statusTransitions: v.optional(
      v.object({
        onBranchPush: v.optional(v.string()),
        onPROpen: v.optional(v.string()),
        onPRMerge: v.optional(v.string()),
      }),
    ),
  }),
  v.check(
    (config) => config.authType !== "api_token" || Boolean(config.email),
    "An API token needs the email address of its Atlassian account",
  ),
);

export type BitbucketConfig = v.InferOutput<typeof bitbucketConfigSchema>;

export type BitbucketCredentials = Pick<
  BitbucketConfig,
  "authType" | "email" | "accessToken"
>;

export async function validateBitbucketConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  const result = v.safeParse(bitbucketConfigSchema, config);
  if (result.success) return { valid: true };
  return {
    valid: false,
    errors: result.issues.map((issue) => issue.message),
  };
}

export const defaultBitbucketConfig: Partial<BitbucketConfig> = {
  branchPattern: "{slug}-{number}",
  statusTransitions: {
    onBranchPush: "in-progress",
    onPROpen: "in-review",
    onPRMerge: "done",
  },
};

export function normalizeBitbucketSlug(value: string): string {
  return value.trim().toLowerCase();
}
