import type { IntegrationPlugin } from "../types";
import { validateBitbucketConfig } from "./config";

// Bitbucket Cloud links branches and pull requests to tasks through webhooks.
// Its issue tracker is optional per repository and not synced.
export const bitbucketPlugin: IntegrationPlugin = {
  type: "bitbucket",
  name: "Bitbucket",
  validateConfig: validateBitbucketConfig,
};
