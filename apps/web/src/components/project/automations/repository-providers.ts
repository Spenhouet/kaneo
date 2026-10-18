import type { ComponentType, SVGProps } from "react";
import { BitbucketIcon } from "@/components/icons/bitbucket-icon";
import { GiteaIcon } from "@/components/icons/gitea-icon";
import { GithubIcon } from "@/components/icons/github-icon";
import { GitlabIcon } from "@/components/icons/gitlab-icon";
import type { WorkflowEvent } from "@/components/project/automations/workflow-events";

export type RepositoryProviderId = "github" | "gitea" | "gitlab" | "bitbucket";

export type RepositoryProvider = {
  id: RepositoryProviderId;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
  // Defaults to every workflow event. Bitbucket has no synced issues.
  events?: readonly WorkflowEvent[];
};

export const REPOSITORY_PROVIDERS: RepositoryProvider[] = [
  {
    id: "github",
    name: "GitHub",
    icon: GithubIcon,
    iconClassName: "text-foreground",
  },
  {
    id: "gitea",
    name: "Gitea",
    icon: GiteaIcon,
    iconClassName: "text-[#609926]",
  },
  {
    id: "gitlab",
    name: "GitLab",
    icon: GitlabIcon,
    iconClassName: "text-[#FC6D26]",
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    icon: BitbucketIcon,
    iconClassName: "text-[#2684FF]",
    events: ["branch_push", "pr_opened", "pr_merged"],
  },
];
