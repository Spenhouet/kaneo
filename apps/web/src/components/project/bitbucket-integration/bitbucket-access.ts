import { tokenFingerprint } from "@/lib/token-fingerprint";

export type BitbucketAuthType = "api_token" | "access_token";

export type BitbucketCredentials = {
  authType: BitbucketAuthType;
  email?: string;
  accessToken: string;
};

export type BitbucketAccess = {
  workspace: string;
  repositorySlug: string;
  credentials?: BitbucketCredentials;
};

// Workspace and repository slugs, as they appear in Bitbucket URLs.
export const BITBUCKET_SLUG_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export function bitbucketAccessKey(access: BitbucketAccess) {
  const { credentials } = access;
  return [
    access.workspace,
    access.repositorySlug,
    credentials
      ? [
          credentials.authType,
          credentials.email ?? "",
          tokenFingerprint(credentials.accessToken),
        ].join(":")
      : "stored",
  ].join("|");
}

export function bitbucketCredentials(
  authType: BitbucketAuthType,
  email: string,
  token: string,
): BitbucketCredentials | null {
  const accessToken = token.trim();
  const trimmedEmail = email.trim();
  if (!accessToken) return null;
  if (authType === "access_token") return { authType, accessToken };
  if (!trimmedEmail.includes("@")) return null;
  return { authType, email: trimmedEmail, accessToken };
}

export function workspaceFromPath(path: string) {
  const [workspace = ""] = path.trim().replace(/^\/+/, "").split("/");
  return BITBUCKET_SLUG_PATTERN.test(workspace) ? workspace : "";
}
