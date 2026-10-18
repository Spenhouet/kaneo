import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { BitbucketIntegrationSettings } from "./bitbucket-integration-settings";

const m = vi.hoisted(() => ({
  verify: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
  integration: { current: null as null | Record<string, unknown> },
}));
const saved = {
  workspace: "example-workspace",
  repositorySlug: "web",
  authType: "access_token",
  maskedAccessToken: "ab…yz",
  webhookUrl: "https://kaneo.example/api/bitbucket-integration/webhook/1",
  webhookSecret: "webhook-secret",
  isActive: true,
};
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock(
  "@/hooks/queries/bitbucket-integration/use-get-bitbucket-integration",
  () => ({
    default: () => ({ data: m.integration.current, isLoading: false }),
  }),
);
vi.mock(
  "@/hooks/mutations/bitbucket-integration/use-create-bitbucket-integration",
  () => ({
    useVerifyBitbucketAccess: () => ({
      mutateAsync: m.verify,
      isPending: false,
    }),
    useCreateBitbucketIntegration: () => ({
      mutateAsync: m.create,
      isPending: false,
    }),
    useDeleteBitbucketIntegration: () => ({
      mutateAsync: m.remove,
      isPending: false,
    }),
  }),
);
vi.mock(
  "@/components/project/bitbucket-integration/bitbucket-repository-picker",
  () => ({
    BitbucketRepositoryPicker: () => null,
  }),
);
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.failure, warning: vi.fn() },
}));

const verified = {
  isInstalled: true,
  hasRequiredPermissions: true,
  message: "Token can access the repository",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
beforeEach(() => {
  m.integration.current = saved;
  m.verify.mockResolvedValue(verified);
});

describe("connected Bitbucket repository", () => {
  it("verifies the saved credentials without sending a token", async () => {
    render(<BitbucketIntegrationSettings projectId="project" />);
    expect(
      await screen.findByText(verified.message, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(m.verify).toHaveBeenCalledWith({
      projectId: "project",
      workspace: "example-workspace",
      repositorySlug: "web",
    });
    expect(screen.queryByText(saved.webhookSecret)).toBeNull();
    expect(
      screen.getByRole("textbox", { name: "settings:codeHosting.webhookUrl" }),
    ).toHaveValue(saved.webhookUrl);
  });

  it("disconnects only after confirmation", async () => {
    m.remove.mockResolvedValue({});
    render(<BitbucketIntegrationSettings projectId="project" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:codeHosting.disconnect" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(m.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:codeHosting.disconnect",
      }),
    );
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith("project"));
  });
});

describe("Bitbucket setup", () => {
  it("connects with an API token and its account email", async () => {
    m.integration.current = null;
    m.create.mockResolvedValue({});
    render(<BitbucketIntegrationSettings projectId="project" />);
    fireEvent.change(
      screen.getByLabelText("settings:bitbucketIntegration.emailLabel"),
      { target: { value: "dev@example.com" } },
    );
    fireEvent.change(
      screen.getByLabelText("settings:bitbucketIntegration.tokenLabel"),
      { target: { value: "token" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "settings:codeHosting.repositoryPathLabel",
      }),
      { target: { value: "example-workspace/web" } },
    );
    expect(
      await screen.findByText(verified.message, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    const data = {
      workspace: "example-workspace",
      repositorySlug: "web",
      authType: "api_token",
      email: "dev@example.com",
      accessToken: "token",
    };
    expect(m.verify).toHaveBeenCalledWith({ projectId: "project", ...data });
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:codeHosting.connectRepository",
      }),
    );
    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({ projectId: "project", data }),
    );
    expect(m.verify).toHaveBeenCalledTimes(1);
  });

  it("does not verify an API token without an email", async () => {
    m.integration.current = null;
    render(<BitbucketIntegrationSettings projectId="project" />);
    fireEvent.change(
      screen.getByLabelText("settings:bitbucketIntegration.tokenLabel"),
      { target: { value: "token" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "settings:codeHosting.repositoryPathLabel",
      }),
      { target: { value: "example-workspace/web" } },
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(m.verify).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", {
        name: "settings:codeHosting.connectRepository",
      }),
    ).toBeDisabled();
  });
});
