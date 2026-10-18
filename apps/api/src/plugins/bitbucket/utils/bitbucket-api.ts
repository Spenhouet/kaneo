import * as Sentry from "@sentry/node";
import type { BitbucketCredentials } from "../config";

export const BITBUCKET_API_URL = "https://api.bitbucket.org/2.0";

export type BitbucketRepository = {
  uuid: string;
  name: string;
  slug: string;
  full_name: string;
  is_private: boolean;
  workspace?: { slug: string };
  links?: { html?: { href: string } };
};

type BitbucketPage<T> = {
  values: T[];
  next?: string;
};

export type BitbucketApiErrorKind = "INVALID_JSON" | "HTTP_ERROR" | "TIMEOUT";

export class BitbucketApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: BitbucketApiErrorKind,
    public body?: string,
  ) {
    super(message);
    this.name = "BitbucketApiError";
  }
}

const BITBUCKET_FETCH_TIMEOUT_MS = 10_000;
const MAX_REPOSITORY_PAGES = 20;

export function bitbucketAuthHeader(credentials: BitbucketCredentials): string {
  if (credentials.authType === "access_token") {
    return `Bearer ${credentials.accessToken}`;
  }
  const basic = Buffer.from(
    `${credentials.email ?? ""}:${credentials.accessToken}`,
  ).toString("base64");
  return `Basic ${basic}`;
}

function apiUrl(path: string): string {
  return `${BITBUCKET_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function bitbucketFetch<T>(
  credentials: BitbucketCredentials,
  pathOrUrl: string,
): Promise<T> {
  // Pagination returns absolute "next" links. Only follow them while they stay
  // on the API host, so a crafted response cannot redirect the credentials.
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : apiUrl(pathOrUrl);
  if (!url.startsWith(`${BITBUCKET_API_URL}/`)) {
    throw new BitbucketApiError(
      "Refusing to call a URL outside the Bitbucket API",
      400,
      "HTTP_ERROR",
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, BITBUCKET_FETCH_TIMEOUT_MS);

  try {
    Sentry.addBreadcrumb({
      category: "integration",
      level: "info",
      data: { integration: "bitbucket" },
    });
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: {
        Authorization: bitbucketAuthHeader(credentials),
        Accept: "application/json",
      },
    });
    const text = await res.text();

    if (!res.ok) {
      throw new BitbucketApiError(
        `Bitbucket API error ${res.status}`,
        res.status,
        "HTTP_ERROR",
        text,
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BitbucketApiError(
        "Bitbucket API returned invalid JSON",
        res.status,
        "INVALID_JSON",
        text,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && timedOut) {
      throw new BitbucketApiError(
        `Bitbucket request timed out after ${BITBUCKET_FETCH_TIMEOUT_MS}ms`,
        408,
        "TIMEOUT",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function repositoryPath(workspace: string, repositorySlug: string) {
  return `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repositorySlug)}`;
}

export function createBitbucketClient(credentials: BitbucketCredentials) {
  return {
    getRepository(workspace: string, repositorySlug: string) {
      return bitbucketFetch<BitbucketRepository>(
        credentials,
        repositoryPath(workspace, repositorySlug),
      );
    },

    // Reading one page of pull requests proves the token has the pull request
    // read scope, which the repository lookup alone does not show.
    async canReadPullRequests(workspace: string, repositorySlug: string) {
      try {
        await bitbucketFetch<BitbucketPage<unknown>>(
          credentials,
          `${repositoryPath(workspace, repositorySlug)}/pullrequests?pagelen=1`,
        );
        return true;
      } catch (error) {
        if (error instanceof BitbucketApiError && error.status === 403) {
          return false;
        }
        throw error;
      }
    },

    async listRepositories(workspace: string) {
      const repositories: BitbucketRepository[] = [];
      let next: string | undefined =
        `/repositories/${encodeURIComponent(workspace)}?pagelen=100&sort=slug`;
      for (let page = 0; next && page < MAX_REPOSITORY_PAGES; page += 1) {
        const result: BitbucketPage<BitbucketRepository> = await bitbucketFetch<
          BitbucketPage<BitbucketRepository>
        >(credentials, next);
        repositories.push(...result.values);
        next = result.next;
      }
      return repositories;
    },
  };
}
