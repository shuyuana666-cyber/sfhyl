import {
  Injectable,
  type LoggerService,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { appendFile, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { toJsonSafe } from "../utils/serialize";

type LogLevel = "debug" | "log" | "warn" | "error" | "fatal";

export interface SystemLogEntry {
  timestamp: string;
  level: LogLevel;
  context?: string;
  message: unknown;
  trace?: string;
}

const SENSITIVE_KEY = /password|secret|authorization|token|cookie/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(item),
      ]),
    );
  }
  return value;
}

@Injectable()
export class JsonLoggerService
  implements LoggerService, OnModuleInit, OnModuleDestroy
{
  private readonly entries: SystemLogEntry[] = [];
  private readonly persistenceEnabled: boolean;
  private readonly filePath: string;
  private readonly maxFileBytes: number;
  private readonly maxFiles: number;
  private writeQueue = Promise.resolve();

  constructor(config: ConfigService) {
    this.persistenceEnabled = config.get<boolean>(
      "SYSTEM_LOG_PERSISTENCE_ENABLED",
      true,
    );
    this.filePath = config.get<string>(
      "SYSTEM_LOG_FILE",
      "./storage/logs/api.jsonl",
    );
    this.maxFileBytes =
      config.get<number>("SYSTEM_LOG_FILE_MAX_MB", 20) * 1024 * 1024;
    this.maxFiles = config.get<number>("SYSTEM_LOG_FILE_MAX_FILES", 5);
  }

  async onModuleInit(): Promise<void> {
    if (!this.persistenceEnabled) return;
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      const rows = await this.readPersistedEntries();
      this.entries.push(...rows.slice(-500));
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "system_log_restore_failed",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.writeQueue;
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const payload: SystemLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message:
        typeof message === "string" ? message : redact(toJsonSafe(message)),
      ...(trace ? { trace } : {}),
    };
    this.entries.push(payload);
    if (this.entries.length > 500)
      this.entries.splice(0, this.entries.length - 500);
    const serialized = JSON.stringify(payload);
    this.persist(serialized);
    if (level === "error" || level === "fatal") console.error(serialized);
    else if (level === "warn") console.warn(serialized);
    else console.log(serialized);
  }

  log(message: unknown, context?: string): void {
    this.write("log", message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string): void {
    if (process.env.NODE_ENV !== "production")
      this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string): void {
    if (process.env.NODE_ENV !== "production")
      this.write("debug", message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write("fatal", message, context);
  }

  recent(limit = 100, level?: LogLevel): SystemLogEntry[] {
    const rows = level
      ? this.entries.filter((entry) => entry.level === level)
      : this.entries;
    return rows.slice(-Math.min(Math.max(limit, 1), 500)).reverse();
  }

  private persist(serialized: string): void {
    if (!this.persistenceEnabled) return;
    this.writeQueue = this.writeQueue
      .then(async () => {
        await mkdir(dirname(this.filePath), { recursive: true });
        await this.rotateIfNeeded(Buffer.byteLength(serialized) + 1);
        await appendFile(this.filePath, `${serialized}\n`, "utf8");
      })
      .catch((error: unknown) => {
        console.warn(
          JSON.stringify({
            event: "system_log_persist_failed",
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      });
  }

  private async readPersistedEntries(): Promise<SystemLogEntry[]> {
    const entries: SystemLogEntry[] = [];
    for (let index = this.maxFiles - 1; index >= 0; index -= 1) {
      const path = index ? `${this.filePath}.${index}` : this.filePath;
      try {
        const content = await readFile(path, "utf8");
        for (const line of content.split("\n")) {
          if (!line.trim()) continue;
          try {
            entries.push(JSON.parse(line) as SystemLogEntry);
          } catch {
            // Keep later valid JSONL entries even if an interrupted write exists.
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return entries;
  }

  private async rotateIfNeeded(nextEntryBytes: number): Promise<void> {
    try {
      const current = await stat(this.filePath);
      if (current.size + nextEntryBytes <= this.maxFileBytes) return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }

    for (let index = this.maxFiles - 1; index >= 1; index -= 1) {
      const source = `${this.filePath}.${index}`;
      const target = `${this.filePath}.${index + 1}`;
      await rm(target, { force: true });
      try {
        await rename(source, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await rm(`${this.filePath}.1`, { force: true });
    await rename(this.filePath, `${this.filePath}.1`);
  }
}
