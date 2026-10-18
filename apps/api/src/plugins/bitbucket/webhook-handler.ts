import { eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { BitbucketConfig } from "./config";
import { verifyBitbucketSignature } from "./utils/verify-signature";
import type { BitbucketPullRequestPayload } from "./webhooks/pull-request";
import { handleBitbucketPullRequestClosed } from "./webhooks/pull-request-closed";
import { handleBitbucketPullRequestOpened } from "./webhooks/pull-request-opened";
import {
  type BitbucketPushPayload,
  handleBitbucketPush,
} from "./webhooks/push";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasRepository(payload: Record<string, unknown>) {
  return (
    isRecord(payload.repository) &&
    typeof payload.repository.full_name === "string"
  );
}

function isPushPayload(
  payload: Record<string, unknown>,
): payload is BitbucketPushPayload {
  return (
    hasRepository(payload) &&
    isRecord(payload.push) &&
    Array.isArray(payload.push.changes)
  );
}

function isPullRequestPayload(
  payload: Record<string, unknown>,
): payload is BitbucketPullRequestPayload {
  if (!hasRepository(payload) || !isRecord(payload.pullrequest)) return false;
  const { id, title, source } = payload.pullrequest;
  return (
    typeof id === "number" &&
    typeof title === "string" &&
    isRecord(source) &&
    isRecord(source.branch) &&
    typeof source.branch.name === "string"
  );
}

export async function handleBitbucketWebhookRequest(
  integrationId: string,
  rawBody: string,
  signatureHeader: string | undefined,
  eventHeader: string | undefined,
): Promise<{ success: boolean; error?: string }> {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });

  if (integration?.type !== "bitbucket") {
    return { success: false, error: "Bitbucket integration not found" };
  }

  let config: BitbucketConfig;
  try {
    config = JSON.parse(integration.config) as BitbucketConfig;
  } catch {
    return { success: false, error: "Invalid integration config" };
  }

  const secret = config.webhookSecret;
  if (!secret) {
    return { success: false, error: "Webhook secret not configured" };
  }

  if (!verifyBitbucketSignature(rawBody, secret, signatureHeader)) {
    return { success: false, error: "Invalid webhook signature" };
  }

  if (!eventHeader) {
    return { success: false, error: "Missing event key" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }
  if (!isRecord(payload)) {
    return { success: false, error: "Invalid JSON payload" };
  }

  try {
    await dispatchBitbucketEvent(eventHeader, payload, integration.id);
    return { success: true };
  } catch (error) {
    console.error("[Bitbucket Webhook] Handler error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook handler failed",
    };
  }
}

async function dispatchBitbucketEvent(
  event: string,
  payload: Record<string, unknown>,
  integrationId: string,
) {
  console.log(`[Bitbucket Webhook] Event: ${event}`);

  switch (event) {
    case "repo:push":
      if (isPushPayload(payload)) {
        await handleBitbucketPush(payload, integrationId);
      }
      return;
    case "pullrequest:created":
    case "pullrequest:updated":
      if (isPullRequestPayload(payload)) {
        await handleBitbucketPullRequestOpened(payload, integrationId);
      }
      return;
    case "pullrequest:fulfilled":
    case "pullrequest:rejected":
      if (isPullRequestPayload(payload)) {
        await handleBitbucketPullRequestClosed(payload, integrationId);
      }
      return;
    default:
      console.log(`[Bitbucket Webhook] Ignored event: ${event}`);
  }
}
