import type { ConfigService } from "@nestjs/config";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonLoggerService } from "./json-logger.service";

function createConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe("JsonLoggerService", () => {
  let directory = "";
  let consoleLog: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "sfhyl-logger-"));
    consoleLog = jest.spyOn(console, "log").mockImplementation();
    consoleWarn = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(async () => {
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
    await rm(directory, { recursive: true, force: true });
  });

  it("persists redacted JSON-safe entries and restores them after restart", async () => {
    const filePath = join(directory, "logs", "api.jsonl");
    const first = new JsonLoggerService(
      createConfig({ SYSTEM_LOG_FILE: filePath }),
    );
    await first.onModuleInit();
    first.log({ actorId: 42n, authorization: "Bearer secret" }, "Test");
    await first.onModuleDestroy();

    await expect(readFile(filePath, "utf8")).resolves.toContain(
      '"authorization":"[REDACTED]"',
    );
    const restarted = new JsonLoggerService(
      createConfig({ SYSTEM_LOG_FILE: filePath }),
    );
    await restarted.onModuleInit();

    expect(restarted.recent()).toEqual([
      expect.objectContaining({
        context: "Test",
        message: { actorId: "42", authorization: "[REDACTED]" },
      }),
    ]);
  });

  it("keeps logging available when persistence is disabled", async () => {
    const filePath = join(directory, "disabled.jsonl");
    const logger = new JsonLoggerService(
      createConfig({
        SYSTEM_LOG_PERSISTENCE_ENABLED: false,
        SYSTEM_LOG_FILE: filePath,
      }),
    );
    await logger.onModuleInit();
    logger.warn("memory only", "Test");
    await logger.onModuleDestroy();

    await expect(access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(logger.recent()).toEqual([
      expect.objectContaining({ level: "warn", message: "memory only" }),
    ]);
  });
});
