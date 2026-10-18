import { z } from "../openapi";

const authType = z.enum(["api_token", "access_token"]).openapi({
  description:
    "api_token: an Atlassian API token, sent with the account email. access_token: a repository, project or workspace access token.",
});

const credentials = {
  authType,
  email: z.email().optional().openapi({
    description: "Atlassian account email. Required with an API token.",
  }),
  accessToken: z.string().min(1),
};

export const listBitbucketRepositoriesBody = z.object({
  projectId: z.string().min(1),
  workspace: z.string().min(1),
  ...credentials,
});

export const verifyBitbucketBody = z.object({
  projectId: z.string().min(1),
  workspace: z.string().min(1),
  repositorySlug: z.string().min(1),
  authType: authType.optional(),
  email: credentials.email,
  accessToken: z.string().min(1).optional().openapi({
    description: "Omit to verify with this project's saved credentials.",
  }),
});

export const createBitbucketBody = z.object({
  workspace: z.string().min(1),
  repositorySlug: z.string().min(1),
  authType: authType.optional(),
  email: credentials.email,
  accessToken: z.string().optional().openapi({
    description:
      "Omit to keep the credentials already stored for this project.",
  }),
});

export const updateBitbucketBody = z.object({
  isActive: z.boolean().optional(),
});
