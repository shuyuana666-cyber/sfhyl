import Joi from "joi";

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3002),
  HOST: Joi.string().hostname().default("127.0.0.1"),
  API_PREFIX: Joi.string().default("api/v1"),
  API_PUBLIC_URL: Joi.string().uri({ scheme: ["http", "https"] }).default("http://localhost:3002"),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ["mysql"] })
    .required(),
  CORS_ORIGINS: Joi.string().default(
    "http://localhost:5173,http://localhost:8848",
  ),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  SETTINGS_ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(32).allow('').optional(),
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
  LOGIN_MAX_ATTEMPTS: Joi.number().integer().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: Joi.number().integer().min(1).max(1440).default(15),
  GLOBAL_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
  GLOBAL_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(120),
  LOGIN_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(5),
  INQUIRY_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(600000),
  INQUIRY_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(5),
  INQUIRY_DUPLICATE_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(10),
  CAPTCHA_PROVIDER: Joi.string()
    .valid("disabled", "turnstile", "hcaptcha")
    .default("disabled"),
  CAPTCHA_SECRET: Joi.string().when("CAPTCHA_PROVIDER", {
    is: Joi.valid("turnstile", "hcaptcha"),
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").default(""),
  }),
  CAPTCHA_VERIFY_URL: Joi.string().uri().allow("").default(""),
  CAPTCHA_VERIFY_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(30_000)
    .default(8000),
  MEDIA_IMAGE_MAX_DIMENSION: Joi.number().integer().min(480).max(8192).default(2560),
  MEDIA_WEBP_QUALITY: Joi.number().integer().min(40).max(100).default(82),
  OPENAI_API_KEY: Joi.string().allow('').default(''),
  OPENAI_BASE_URL: Joi.string().uri({ scheme: ['https'] }).default('https://api.openai.com/v1'),
  OPENAI_TRANSLATION_PROTOCOL: Joi.string().valid('openai', 'anthropic').default('openai'),
  OPENAI_TRANSLATION_MODEL: Joi.string().min(1).default('gpt-4o-mini'),
  SWAGGER_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  STORAGE_DRIVER: Joi.string()
    .valid("local", "minio", "aliyun-oss", "tencent-cos")
    .default("local"),
  STORAGE_PUBLIC_URL: Joi.string()
    .uri({ scheme: ["http", "https"] })
    .allow("")
    .default(""),
  LOCAL_STORAGE_PATH: Joi.string().default("./storage"),
  MINIO_ENDPOINT: Joi.string().hostname().default("127.0.0.1"),
  MINIO_PORT: Joi.number().port().default(9000),
  MINIO_USE_SSL: Joi.boolean().truthy("true").falsy("false").default(false),
  MINIO_ACCESS_KEY: Joi.string().when("STORAGE_DRIVER", {
    is: "minio",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  MINIO_SECRET_KEY: Joi.string().when("STORAGE_DRIVER", {
    is: "minio",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  MINIO_BUCKET: Joi.string().default("sfhyl"),
  MINIO_REGION: Joi.string().allow("").default(""),
  MINIO_PATH_STYLE: Joi.boolean().default(true),
  MINIO_SESSION_TOKEN: Joi.string().allow("").default(""),
  MINIO_PUBLIC_READ: Joi.boolean().default(false),
  ALIYUN_OSS_ENDPOINT: Joi.string().when("STORAGE_DRIVER", {
    is: "aliyun-oss",
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  ALIYUN_OSS_REGION: Joi.string().allow("").default(""),
  ALIYUN_OSS_ACCESS_KEY_ID: Joi.string().when("STORAGE_DRIVER", {
    is: "aliyun-oss",
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  ALIYUN_OSS_ACCESS_KEY_SECRET: Joi.string().when("STORAGE_DRIVER", {
    is: "aliyun-oss",
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  ALIYUN_OSS_BUCKET: Joi.string().when("STORAGE_DRIVER", {
    is: "aliyun-oss",
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  ALIYUN_OSS_PUBLIC_URL: Joi.string().uri().allow("").default(""),
  TENCENT_COS_REGION: Joi.string().when("STORAGE_DRIVER", {
    is: "tencent-cos",
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  TENCENT_COS_SECRET_ID: Joi.string().when("STORAGE_DRIVER", {
    is: "tencent-cos",
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  TENCENT_COS_SECRET_KEY: Joi.string().when("STORAGE_DRIVER", {
    is: "tencent-cos",
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  TENCENT_COS_BUCKET: Joi.string().when("STORAGE_DRIVER", {
    is: "tencent-cos",
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  TENCENT_COS_PUBLIC_URL: Joi.string().uri().allow("").default(""),
  REDIS_ENABLED: Joi.boolean().truthy("true").falsy("false").default(false),
  REDIS_HOST: Joi.string().default("127.0.0.1"),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").optional(),
  REDIS_USERNAME: Joi.string().allow("").default(""),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_TLS: Joi.boolean().default(false),
  REDIS_KEY_PREFIX: Joi.string().pattern(/^[A-Za-z0-9:_-]+$/).default("sfhyl"),
  PUBLIC_CACHE_TTL_SECONDS: Joi.number().integer().min(10).max(3600).default(120),
  SYSTEM_LOG_PERSISTENCE_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(true),
  SYSTEM_LOG_FILE: Joi.string().default("./storage/logs/api.jsonl"),
  SYSTEM_LOG_FILE_MAX_MB: Joi.number().integer().min(1).max(100).default(20),
  SYSTEM_LOG_FILE_MAX_FILES: Joi.number().integer().min(1).max(20).default(5),
  MEDIA_GENERATE_THUMBNAILS: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(true),
  MEDIA_THUMBNAIL_WIDTH: Joi.number().integer().min(64).max(2000).default(480),
  MEDIA_GENERATE_WEBP: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(true),
  HOMEPAGE_DEFAULT_ASSETS_DIR: Joi.string().allow("").default(""),
  UPLOAD_MAX_IMAGE_MB: Joi.number().integer().min(1).max(50).default(15),
  UPLOAD_MAX_VIDEO_MB: Joi.number().integer().min(1).max(500).default(100),
  INQUIRY_NOTIFICATION_EMAIL_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(false),
  INQUIRY_NOTIFICATION_WHATSAPP_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(false),
  MAIL_ENABLED: Joi.boolean().truthy("true").falsy("false").default(false),
  SMTP_HOST: Joi.string().when("MAIL_ENABLED", {
    is: true,
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().truthy("true").falsy("false").default(false),
  SMTP_USERNAME: Joi.string().allow("").default(""),
  SMTP_PASSWORD: Joi.string().allow("").default(""),
  MAIL_FROM_NAME: Joi.string().max(120).default("SFHYL.CN"),
  MAIL_FROM_ADDRESS: Joi.string().email().allow("").default(""),
});

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
