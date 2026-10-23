import type { ConfigService } from "@nestjs/config";

export function publicStorageUrl(config: ConfigService, driver: "local" | "minio"): string {
  const configured = config.get<string>("STORAGE_PUBLIC_URL", "");
  if (configured) return configured.replace(/\/+$/, "");
  if (driver === "local") {
    return `${config.get<string>("API_PUBLIC_URL", "http://localhost:3002").replace(/\/+$/, "")}/uploads`;
  }
  const protocol = config.get<boolean>("MINIO_USE_SSL", false) ? "https" : "http";
  const host = config.get<string>("MINIO_ENDPOINT", "127.0.0.1");
  const port = config.get<number>("MINIO_PORT", 9000);
  const bucket = config.get<string>("MINIO_BUCKET", "sfhyl");
  return config.get<boolean>("MINIO_PATH_STYLE", true)
    ? `${protocol}://${host}:${port}/${bucket}`
    : `${protocol}://${bucket}.${host}:${port}`;
}
