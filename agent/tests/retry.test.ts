import { withRetry } from "../src/utils/retry";

function createTestLogger() {
  return {
    warn: () => undefined,
  } as any;
}

describe("withRetry", () => {
  it("returns on first successful attempt", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        return "ok";
      },
      {
        attempts: 3,
        baseDelayMs: 1,
        operationName: "test",
        logger: createTestLogger(),
      }
    );

    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries until success", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error("temporary");
        }
        return "done";
      },
      {
        attempts: 4,
        baseDelayMs: 1,
        operationName: "test",
        logger: createTestLogger(),
      }
    );

    expect(result).toBe("done");
    expect(calls).toBe(3);
  });

  it("throws after max attempts", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("always-fail");
        },
        {
          attempts: 3,
          baseDelayMs: 1,
          operationName: "test",
          logger: createTestLogger(),
        }
      )
    ).rejects.toThrow("always-fail");

    expect(calls).toBe(3);
  });
});
