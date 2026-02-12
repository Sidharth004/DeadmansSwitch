import { createCommandRateLimitMiddleware } from "../src/bot/rate-limit";

function makeConfig(overrides: Partial<any> = {}) {
  return {
    botRateLimitWindowMs: 1000,
    botRateLimitMaxCommands: 2,
    ...overrides,
  } as any;
}

function makeLogger() {
  return {
    warn: () => undefined,
  } as any;
}

describe("createCommandRateLimitMiddleware", () => {
  it("allows commands under the rate limit", async () => {
    const middleware = createCommandRateLimitMiddleware(
      makeConfig(),
      makeLogger()
    );

    let nextCalls = 0;
    const next = async () => {
      nextCalls += 1;
    };

    const replies: string[] = [];
    const ctx = {
      message: { text: "/status" },
      chat: { id: 123 },
      reply: async (text: string) => {
        replies.push(text);
      },
    } as any;

    await middleware(ctx, next);
    await middleware(ctx, next);

    expect(nextCalls).toBe(2);
    expect(replies).toHaveLength(0);
  });

  it("blocks when command limit is exceeded", async () => {
    const middleware = createCommandRateLimitMiddleware(
      makeConfig(),
      makeLogger()
    );

    let nextCalls = 0;
    const next = async () => {
      nextCalls += 1;
    };

    const replies: string[] = [];
    const ctx = {
      message: { text: "/status" },
      chat: { id: 123 },
      reply: async (text: string) => {
        replies.push(text);
      },
    } as any;

    await middleware(ctx, next);
    await middleware(ctx, next);
    await middleware(ctx, next);

    expect(nextCalls).toBe(2);
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain("Rate limit exceeded");
  });

  it("does not count non-command messages", async () => {
    const middleware = createCommandRateLimitMiddleware(
      makeConfig({ botRateLimitMaxCommands: 1 }),
      makeLogger()
    );

    let nextCalls = 0;
    const next = async () => {
      nextCalls += 1;
    };

    const commandCtx = {
      message: { text: "/status" },
      chat: { id: 123 },
      reply: async () => undefined,
    } as any;

    const plainCtx = {
      message: { text: "hello there" },
      chat: { id: 123 },
      reply: async () => undefined,
    } as any;

    await middleware(plainCtx, next);
    await middleware(commandCtx, next);

    expect(nextCalls).toBe(2);
  });
});
