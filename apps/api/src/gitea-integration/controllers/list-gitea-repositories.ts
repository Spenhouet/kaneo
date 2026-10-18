import { HTTPException } from "hono/http-exception";
import { normalizeGiteaBaseUrl } from "../../plugins/gitea/config";
import {
  createGiteaClient,
  GiteaApiError,
  verifyGiteaToken,
} from "../../plugins/gitea/utils/gitea-api";

type RepoRow = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string };
  html_url: string;
};

async function listGiteaRepositories({
  baseUrl,
  accessToken,
}: {
  baseUrl: string;
  accessToken: string;
}): Promise<{ repositories: RepoRow[] }> {
  const normalized = normalizeGiteaBaseUrl(baseUrl);

  try {
    await verifyGiteaToken(normalized, accessToken);
  } catch (error) {
    if (
      error instanceof GiteaApiError &&
      error.kind === "BLOCKED_DESTINATION"
    ) {
      throw new HTTPException(400, { message: error.message });
    }
    throw new HTTPException(400, {
      message: "Invalid Gitea token or could not reach instance.",
    });
  }

  const client = createGiteaClient({
    baseUrl: normalized,
    accessToken,
  });

  const all: RepoRow[] = [];
  let page = 1;

  while (true) {
    const batch = await client.listUserRepos(page, 50);
    if (!batch.length) break;

    for (const repo of batch) {
      const ownerLogin = repo.owner?.login ?? repo.owner?.username ?? "";
      all.push({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        owner: { login: ownerLogin },
        html_url: repo.html_url,
      });
    }

    if (batch.length < 50) break;
    page += 1;
    if (page > 50) break;
  }

  return { repositories: all };
}

export default listGiteaRepositories;
