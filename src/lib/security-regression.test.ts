import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<{ data: unknown; error?: unknown }>,
  filters: [] as Array<[string, unknown]>,
  info: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: (input: unknown) => unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestIP: () => "127.0.0.1" }));
vi.mock("./admin.server", () => ({ verifyTurnstile: async () => true }));
vi.mock("./audit.server", () => ({ writeAudit: async () => undefined }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: { from: () => ({ info: mocks.info }) },
  },
}));

import { submitPaymentRequest } from "./public.functions";
import { getPortalTarget } from "./member.functions";

const proofPath = "proofs/12345678-1234-1234-1234-123456789abc.png";
const payment = {
  holderName: "Test member", email: "regression@example.invalid", phone: "1234567890",
  password: "abc12", planCode: "test-plan", screenshotPath: proofPath,
};

// Exercise the real handler with mocked external services, without creating accounts or payments.
const submit = submitPaymentRequest as unknown as (input: { data: typeof payment }) => Promise<{ ok: boolean; error?: string }>;
const target = getPortalTarget as unknown as (input: { context: { userId: string } }) => Promise<{ url: string | null; reason: string | null }>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = [];
  mocks.filters = [];
  mocks.info.mockResolvedValue({ data: { id: "uploaded-proof" }, error: null });
  mocks.from.mockImplementation(() => {
    const result = mocks.rows.shift() ?? { data: null };
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => { mocks.filters.push([column, value]); return query; },
      order: () => query,
      limit: () => query,
      update: () => query,
      maybeSingle: async () => result,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
});

describe("payment proof and plan rules", () => {
  test("inactive plans are excluded by the purchase handler", async () => {
    mocks.rows = [{ data: null }];
    expect(await submit({ data: payment })).toEqual({ ok: false, error: "Please choose a valid plan." });
    expect(mocks.filters).toContainEqual(["is_active", true]);
    expect(mocks.info).not.toHaveBeenCalled();
  });
  test("a non-issued proof path is rejected", async () => {
    mocks.rows = [{ data: { code: "test-plan" } }];
    expect((await submit({ data: { ...payment, screenshotPath: "someone-elses.png" } })).ok).toBe(false);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  test("an already attached payment proof is rejected", async () => {
    mocks.rows = [{ data: { code: "test-plan" } }, { data: { id: "existing-payment" } }];
    expect((await submit({ data: payment })).ok).toBe(false);
    expect(mocks.filters).toContainEqual(["screenshot_path", proofPath]);
    expect(mocks.info).not.toHaveBeenCalled();
  });
  test("an unuploaded proof is rejected before any account creation", async () => {
    mocks.rows = [{ data: { code: "test-plan" } }, { data: null }];
    mocks.info.mockResolvedValue({ data: null, error: { message: "Not found" } });
    expect(await submit({ data: payment })).toEqual({ ok: false, error: "Please upload your payment screenshot again." });
    expect(mocks.info).toHaveBeenCalledWith(proofPath);
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });
  test("proof lookup failures fail closed", async () => {
    mocks.rows = [{ data: { code: "test-plan" } }, { data: null, error: { message: "Unavailable" } }];
    expect((await submit({ data: payment })).ok).toBe(false);
    expect(mocks.info).not.toHaveBeenCalled();
  });
  test("an uploaded unused proof passes validation to the account check", async () => {
    mocks.rows = [{ data: { code: "test-plan" } }, { data: null }, { data: null }, { data: null }, { data: { id: "existing-phone" } }];
    expect((await submit({ data: payment })).error).toBe("This phone number is already registered. Use your existing email.");
    expect(mocks.info).toHaveBeenCalledWith(proofPath);
    expect(mocks.from).toHaveBeenCalledWith("profiles");
  });
});

describe("member access rules", () => {
  test("suspended members cannot get a study launch path", async () => {
    mocks.rows = [{ data: { status: "suspended" } }];
    expect(await target({ context: { userId: "test-member" } })).toMatchObject({ url: null, reason: "Your account is suspended. Contact support." });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  test("members without an active subscription are denied", async () => {
    mocks.rows = [{ data: { status: "active" } }, { data: null }];
    expect(await target({ context: { userId: "test-member" } })).toMatchObject({ url: null, reason: "No active subscription." });
    expect(mocks.filters).toContainEqual(["status", "active"]);
  });
  test("expired subscriptions are denied", async () => {
    mocks.rows = [{ data: { status: "active" } }, { data: { status: "active", expires_at: "2000-01-01T00:00:00Z" } }];
    expect(await target({ context: { userId: "test-member" } })).toMatchObject({ url: null, reason: "Your subscription has expired." });
  });
  test("unexpired active members retain their launch path", async () => {
    mocks.rows = [{ data: { status: "active" } }, { data: { status: "active", expires_at: "2099-01-01T00:00:00Z", plan_code: "test-plan" } }, { data: { content_headers: "" } }];
    expect(await target({ context: { userId: "test-member" } })).toMatchObject({ url: "/api/portal/", reason: null });
    expect(mocks.filters).toContainEqual(["id", "test-member"]);
  });
});