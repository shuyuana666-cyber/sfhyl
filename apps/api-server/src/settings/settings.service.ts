import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../common/utils/request-meta';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

type SettingType = 'string' | 'boolean';
export type TranslationProtocol = 'openai' | 'anthropic';

export interface TranslationModelSettings {
  protocol?: TranslationProtocol;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

interface SettingDefinition {
  type: SettingType;
  maxLength?: number;
  allowedValues?: readonly string[];
  isPublic?: boolean;
  isSensitive?: boolean;
  required?: boolean;
  url?: boolean;
}

export const TRANSLATION_MODEL_GROUP = 'translation_model';
const ENCRYPTED_SECRET_PREFIX = 'enc:v1:';

const DEFINITIONS: Record<string, Record<string, SettingDefinition>> = {
  basic: {
    siteNameZh: { type: 'string', maxLength: 120 },
    siteNameEn: { type: 'string', maxLength: 120 },
    siteNameRu: { type: 'string', maxLength: 120 },
    shortName: { type: 'string', maxLength: 64 },
    defaultLanguage: { type: 'string', maxLength: 16 },
    defaultCurrency: { type: 'string', maxLength: 8 },
    timezone: { type: 'string', maxLength: 64 },
    siteDescription: { type: 'string', maxLength: 1000 },
    companyNameZh: { type: 'string', maxLength: 255 },
    companyNameEn: { type: 'string', maxLength: 255 },
  },
  branding: {
    logoUrl: { type: 'string', maxLength: 2048 },
    darkLogoUrl: { type: 'string', maxLength: 2048 },
    mobileLogoUrl: { type: 'string', maxLength: 2048 },
    faviconUrl: { type: 'string', maxLength: 2048 },
    shareImageUrl: { type: 'string', maxLength: 2048 },
  },
  contact: {
    phone: { type: 'string', maxLength: 64 },
    whatsapp: { type: 'string', maxLength: 64 },
    wechat: { type: 'string', maxLength: 120 },
    email: { type: 'string', maxLength: 191 },
    address: { type: 'string', maxLength: 1000 },
    businessHours: { type: 'string', maxLength: 255 },
  },
  social: {
    whatsapp: { type: 'string', maxLength: 2048, url: true },
    facebook: { type: 'string', maxLength: 2048 },
    instagram: { type: 'string', maxLength: 2048 },
    youtube: { type: 'string', maxLength: 2048 },
    linkedin: { type: 'string', maxLength: 2048 },
    tiktok: { type: 'string', maxLength: 2048 },
    x: { type: 'string', maxLength: 2048 },
    vk: { type: 'string', maxLength: 2048 },
  },
  seo: {
    defaultTitle: { type: 'string', maxLength: 255 },
    defaultKeywords: { type: 'string', maxLength: 500 },
    defaultDescription: { type: 'string', maxLength: 1000 },
  },
  footer: {
    copyright: { type: 'string', maxLength: 500 },
    icpNumber: { type: 'string', maxLength: 120 },
    publicSecurityNumber: { type: 'string', maxLength: 120 },
  },
  features: {
    maintenanceMode: { type: 'boolean' },
    maintenanceMessage: { type: 'string', maxLength: 500 },
  },
  [TRANSLATION_MODEL_GROUP]: {
    protocol: {
      type: 'string',
      maxLength: 16,
      allowedValues: ['openai', 'anthropic'],
      isPublic: false,
      required: true,
    },
    baseUrl: {
      type: 'string',
      maxLength: 2048,
      isPublic: false,
      required: true,
      url: true,
    },
    apiKey: {
      type: 'string',
      maxLength: 2048,
      isPublic: false,
      isSensitive: true,
    },
    model: {
      type: 'string',
      maxLength: 255,
      isPublic: false,
      required: true,
    },
  },
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService = new ConfigService(),
  ) {}

  async adminSettings(): Promise<Record<string, Record<string, unknown>>> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { isSensitive: false },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    const settings = this.group(rows);
    const apiKey = await this.prisma.siteSetting.findUnique({
      where: {
        group_key: { group: TRANSLATION_MODEL_GROUP, key: 'apiKey' },
      },
      select: { value: true },
    });
    if (this.stringValue(apiKey?.value)) {
      settings[TRANSLATION_MODEL_GROUP] ??= {};
      settings[TRANSLATION_MODEL_GROUP].apiKeyConfigured = true;
    }
    return settings;
  }

  async publicSettings(): Promise<Record<string, Record<string, unknown>>> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { isPublic: true, isSensitive: false },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    return this.group(rows);
  }

  async translationModelSettings(): Promise<TranslationModelSettings> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { group: TRANSLATION_MODEL_GROUP },
    });
    const values = this.group(rows)[TRANSLATION_MODEL_GROUP] ?? {};
    const apiKeyRow = rows.find((row) => row.key === 'apiKey');
    const storedApiKey = this.stringValue(apiKeyRow?.value);
    const apiKey = storedApiKey ? this.decryptApiKey(storedApiKey) : undefined;

    // Existing installations stored this setting as plaintext. Keep reading it
    // during rollout, then migrate it in place once the deployment key exists.
    if (storedApiKey && apiKeyRow && !storedApiKey.startsWith(ENCRYPTED_SECRET_PREFIX)) {
      const encryptionKey = this.encryptionKey(false);
      if (encryptionKey) {
        await this.prisma.siteSetting.updateMany({
          where: { id: apiKeyRow.id, value: { equals: storedApiKey } },
          data: { value: this.encryptApiKey(storedApiKey, encryptionKey) },
        });
      }
    }
    const protocol = values.protocol;

    return {
      protocol:
        protocol === 'openai' || protocol === 'anthropic' ? protocol : undefined,
      baseUrl: this.stringValue(values.baseUrl),
      apiKey,
      model: this.stringValue(values.model),
    };
  }

  async updateGroup(
    group: string,
    settings: Record<string, unknown>,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<Record<string, unknown>> {
    const definitions = DEFINITIONS[group];
    if (!definitions) throw new BadRequestException('Unsupported settings group.');

    const entries = this.normalizeEntries(group, settings);
    if (!entries.length) throw new BadRequestException('No settings to save.');
    for (const [key, value] of entries) this.validateValue(key, value, definitions[key]);

    const existingApiKey = group === TRANSLATION_MODEL_GROUP
      ? await this.currentTranslationApiKey()
      : undefined;
    this.validateTranslationModel(group, entries, existingApiKey);
    const savedEntries = entries.filter(([key, value]) =>
      group !== TRANSLATION_MODEL_GROUP || key !== 'apiKey' || Boolean(value),
    );

    if (!savedEntries.length) {
      return { apiKeyConfigured: Boolean(existingApiKey) };
    }

    const keys = savedEntries.map(([key]) => key);
    const before = await this.prisma.siteSetting.findMany({
      where: { group, key: { in: keys } },
    });
    await this.prisma.$transaction(
      savedEntries.map(([key, value]) =>
        this.prisma.siteSetting.upsert({
          where: { group_key: { group, key } },
          update: {
          value: this.settingValueForStorage(group, key, value) as Prisma.InputJsonValue,
            isPublic: definitions[key]!.isPublic ?? true,
            isSensitive: definitions[key]!.isSensitive ?? false,
            updatedById: actorId,
          },
          create: {
            group,
            key,
          value: this.settingValueForStorage(group, key, value) as Prisma.InputJsonValue,
            isPublic: definitions[key]!.isPublic ?? true,
            isSensitive: definitions[key]!.isSensitive ?? false,
            createdById: actorId,
            updatedById: actorId,
          },
        }),
      ),
    );
    const after = await this.prisma.siteSetting.findMany({
      where: { group, key: { in: keys } },
    });
    await this.audit.record({
      actorId,
      action: 'update',
      resourceType: 'site_settings',
      resourceId: group,
      beforeData: this.redactSensitiveSettings(before),
      afterData: this.redactSensitiveSettings(after),
      meta,
    });
    const result = Object.fromEntries(after.map((setting) => [setting.key, setting.value]));
    if (group === TRANSLATION_MODEL_GROUP) {
      delete result.apiKey;
      result.apiKeyConfigured = Boolean(
        existingApiKey || entries.some(([key, value]) => key === 'apiKey' && value),
      );
    }
    return result;
  }

  private validateValue(key: string, value: unknown, definition?: SettingDefinition): void {
    if (!definition) throw new BadRequestException(`Unsupported settings key: ${key}`);
    if (typeof value !== definition.type) throw new BadRequestException(`Invalid value type for ${key}.`);
    if (typeof value === 'string' && definition.maxLength && value.length > definition.maxLength) {
      throw new BadRequestException(`Setting ${key} exceeds the length limit.`);
    }
    if (typeof value === 'string' && definition.required && !value) {
      throw new BadRequestException(`Setting ${key} is required.`);
    }
    if (typeof value === 'string' && definition.allowedValues && !definition.allowedValues.includes(value)) {
      throw new BadRequestException(`Unsupported value for ${key}.`);
    }
    if (typeof value === 'string' && definition.url && value) this.validateHttpsUrl(key, value);
  }

  private normalizeEntries(group: string, settings: Record<string, unknown>): Array<[string, unknown]> {
    return Object.entries(settings).map(([key, value]) => [
      key,
      group === TRANSLATION_MODEL_GROUP && typeof value === 'string' ? value.trim() : value,
    ]);
  }

  private async currentTranslationApiKey(): Promise<string | undefined> {
    const setting = await this.prisma.siteSetting.findUnique({
      where: {
        group_key: { group: TRANSLATION_MODEL_GROUP, key: 'apiKey' },
      },
      select: { value: true },
    });
    const value = this.stringValue(setting?.value);
    return value ? this.decryptApiKey(value) : undefined;
  }

  private settingValueForStorage(group: string, key: string, value: unknown): unknown {
    if (group === TRANSLATION_MODEL_GROUP && key === 'apiKey' && typeof value === 'string' && value) {
      return this.encryptApiKey(value);
    }
    return value;
  }

  private encryptionKey(required: boolean): Buffer | null {
    const configured = this.config.get<string>('SETTINGS_ENCRYPTION_KEY', '').trim();
    if (!configured) {
      if (required) {
        throw new ServiceUnavailableException('Settings encryption is not configured.');
      }
      return null;
    }
    if (configured.length < 32) {
      throw new ServiceUnavailableException('Settings encryption key must contain at least 32 characters.');
    }
    return createHash('sha256').update(configured, 'utf8').digest();
  }

  private encryptApiKey(value: string, key = this.encryptionKey(true)!): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${ENCRYPTED_SECRET_PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
  }

  private decryptApiKey(value: string): string {
    if (!value.startsWith(ENCRYPTED_SECRET_PREFIX)) return value;
    const parts = value.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      throw new ServiceUnavailableException('Stored translation API key has an invalid encrypted format.');
    }
    const key = this.encryptionKey(true)!;
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[2]!, 'base64url'));
      decipher.setAuthTag(Buffer.from(parts[3]!, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(parts[4]!, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('Stored translation API key could not be decrypted.');
    }
  }

  private validateTranslationModel(
    group: string,
    entries: Array<[string, unknown]>,
    existingApiKey?: string,
  ): void {
    if (group !== TRANSLATION_MODEL_GROUP) return;
    const incomingApiKey = entries.find(([key]) => key === 'apiKey')?.[1];
    if (typeof incomingApiKey !== 'string' || (!incomingApiKey && !existingApiKey)) {
      throw new BadRequestException('Translation API key is required.');
    }
  }

  private validateHttpsUrl(key: string, value: string): void {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error();
    } catch {
      throw new BadRequestException(`Setting ${key} must be an HTTPS URL.`);
    }
  }

  private redactSensitiveSettings(
    rows: Array<{ group: string; key: string; value: Prisma.JsonValue }>,
  ): Array<Record<string, unknown>> {
    return rows.map((row) =>
      row.group === TRANSLATION_MODEL_GROUP && row.key === 'apiKey'
        ? { ...row, value: '[configured]' }
        : row,
    );
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private group(rows: Array<{ group: string; key: string; value: Prisma.JsonValue }>): Record<string, Record<string, unknown>> {
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      grouped[row.group] ??= {};
      grouped[row.group]![row.key] = row.value;
    }
    return grouped;
  }
}
