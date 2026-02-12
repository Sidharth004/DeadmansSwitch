import { notifyStateTransition } from "../src/notifications";
import { sendTelegramMessage } from "../src/notifications/telegram";
import { sendEmail } from "../src/notifications/email";

vi.mock("../src/notifications/telegram", () => ({
  sendTelegramMessage: vi.fn(),
}));

vi.mock("../src/notifications/email", () => ({
  sendEmail: vi.fn(),
}));

function makeConfig(overrides: Partial<any> = {}) {
  return {
    appUrl: "http://localhost:3000",
    notificationRetryAttempts: 1,
    notificationRetryBaseDelayMs: 1,
    ...overrides,
  } as any;
}

function makeLogger() {
  return {
    error: () => undefined,
    warn: () => undefined,
    info: () => undefined,
    debug: () => undefined,
  } as any;
}

function makeVault(overrides: Partial<any> = {}) {
  return {
    id: "v1",
    owner_address: "7f5hEe2B9RjR6Mo3G68WwSKpExQ4cPPMz4Q2s3A6mAUE",
    vault_pda: "5fAHpmgRzV69xWv2jSEYwHqmCcXWMB4FGb6Yh2WrSC1k",
    state: "warning",
    warning_period_days: 90,
    challenge_period_days: 15,
    telegram_chat_id: "123",
    owner_email: "owner@example.com",
    last_activity_reminder_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as any;
}

describe("notifyStateTransition resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues to email even if telegram fails", async () => {
    vi.mocked(sendTelegramMessage).mockRejectedValue(new Error("telegram down"));
    vi.mocked(sendEmail).mockResolvedValue();

    await expect(
      notifyStateTransition(
        "warning",
        makeVault(),
        {} as any,
        makeConfig(),
        makeLogger()
      )
    ).resolves.toBeUndefined();

    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("continues to telegram even if email fails", async () => {
    vi.mocked(sendTelegramMessage).mockResolvedValue();
    vi.mocked(sendEmail).mockRejectedValue(new Error("email down"));

    await expect(
      notifyStateTransition(
        "warning",
        makeVault(),
        {} as any,
        makeConfig(),
        makeLogger()
      )
    ).resolves.toBeUndefined();

    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
