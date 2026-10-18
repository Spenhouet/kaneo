import { responseTimestamp, z } from "../openapi";

// Credentials are only ever returned masked; the webhook secret goes only to
// callers holding workspace:manage_settings.
export const bitbucketIntegrationSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    workspace: z.string(),
    repositorySlug: z.string(),
    authType: z.enum(["api_token", "access_token"]),
    email: z.string().optional(),
    maskedAccessToken: z.string(),
    webhookUrl: z.string().openapi({
      description: "Where Bitbucket should POST events for this project.",
    }),
    webhookSecret: z.string().openapi({
      description:
        "Only returned to callers with workspace:manage_settings, so the value can be pasted into Bitbucket.",
    }),
    branchPattern: z.string().optional(),
    isActive: z.boolean().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("BitbucketIntegration");

export const bitbucketRepositorySchema = z
  .object({
    uuid: z.string(),
    slug: z.string(),
    name: z.string(),
    full_name: z.string(),
    workspace: z.string(),
    private: z.boolean(),
    html_url: z.string(),
  })
  .openapi("BitbucketRepository");

export const bitbucketRepositoryListSchema = z
  .object({ repositories: z.array(bitbucketRepositorySchema) })
  .openapi("BitbucketRepositoryList");

export const bitbucketVerificationResultSchema = z
  .object({
    isInstalled: z.boolean().openapi({
      description: "True when the credentials reach the repository.",
    }),
    hasRequiredPermissions: z.boolean(),
    repositoryExists: z.boolean(),
    repositoryPrivate: z.boolean().nullable(),
    missingPermissions: z.array(z.string()),
    message: z.string().openapi({
      description: "A human-readable summary to show the user.",
    }),
    failureReason: z
      .enum(["invalid_credentials", "repository_not_found"])
      .nullable(),
  })
  .openapi("BitbucketVerificationResult");

export const bitbucketDeleteResultSchema = z
  .object({ success: z.boolean(), message: z.string() })
  .openapi("BitbucketDeleteResult");
