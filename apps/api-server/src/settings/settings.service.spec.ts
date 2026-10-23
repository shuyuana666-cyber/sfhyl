import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

const meta = {
  method: 'PATCH',
  path: '/api/v1/admin/settings/translation_model',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  requestId: 'test-request',
  durationMs: 1,
};

function createService() {
  const prisma = {
    siteSetting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ id: 1n }),
    },
    $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { service: new SettingsService(prisma as never, audit as never), prisma, audit };
}

describe('SettingsService translation model settings', () => {
  it('returns only a configured state for the API key', async () => {
    const { service, prisma } = createService();
    prisma.siteSetting.findMany.mockResolvedValue([
      { group: 'translation_model', key: 'protocol', value: 'openai' },
      { group: 'translation_model', key: 'baseUrl', value: 'https://api.example/v1' },
      { group: 'translation_model', key: 'model', value: 'gpt-test' },
    ]);
    prisma.siteSetting.findUnique.mockResolvedValue({ value: 'secret-key' });

    await expect(service.adminSettings()).resolves.toEqual({
      translation_model: {
        protocol: 'openai',
        baseUrl: 'https://api.example/v1',
        model: 'gpt-test',
        apiKeyConfigured: true,
      },
    });
  });

  it('preserves an existing blank API key and stores the other settings privately', async () => {
    const { service, prisma, audit } = createService();
    prisma.siteSetting.findUnique.mockResolvedValue({ value: 'current-secret' });
    prisma.siteSetting.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { group: 'translation_model', key: 'protocol', value: 'anthropic' },
        { group: 'translation_model', key: 'baseUrl', value: 'https://api.anthropic.com' },
        { group: 'translation_model', key: 'model', value: 'claude-test' },
      ]);

    await expect(service.updateGroup('translation_model', {
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: '',
      model: 'claude-test',
    }, 1n, meta)).resolves.toEqual({
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-test',
      apiKeyConfigured: true,
    });

    expect(prisma.siteSetting.upsert).toHaveBeenCalledTimes(3);
    const upsertCalls = prisma.siteSetting.upsert.mock.calls as unknown as Array<[{
      create?: { isPublic?: boolean; isSensitive?: boolean };
    }]>;
    expect(upsertCalls[0]?.[0]).toMatchObject({
      create: { isPublic: false, isSensitive: false },
    });
    const auditCalls = audit.record.mock.calls as unknown as Array<[{ afterData?: string | null }]>;
    expect(auditCalls[0]?.[0]?.afterData).not.toContain('current-secret');
  });

  it('requires a key the first time and rejects non-HTTPS base URLs', async () => {
    const { service, prisma } = createService();
    prisma.siteSetting.findUnique.mockResolvedValue(null);

    await expect(service.updateGroup('translation_model', {
      protocol: 'openai',
      baseUrl: 'https://api.example/v1',
      apiKey: '',
      model: 'gpt-test',
    }, 1n, meta)).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.updateGroup('translation_model', {
      protocol: 'openai',
      baseUrl: 'http://api.example/v1',
      apiKey: 'new-secret',
      model: 'gpt-test',
    }, 1n, meta)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SettingsService social settings', () => {
  it('accepts a public WhatsApp link or an empty override and rejects unsafe schemes', async () => {
    const { service, prisma } = createService();
    prisma.siteSetting.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ group: 'social', key: 'whatsapp', value: 'https://wa.me/79140693189' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ group: 'social', key: 'whatsapp', value: '' }]);

    await expect(service.updateGroup('social', {
      whatsapp: 'https://wa.me/79140693189',
    }, 1n, meta)).resolves.toEqual({ whatsapp: 'https://wa.me/79140693189' });
    const upsertCalls = prisma.siteSetting.upsert.mock.calls as unknown as Array<[unknown]>;
    expect(upsertCalls[0]?.[0]).toMatchObject({
      create: { group: 'social', key: 'whatsapp', isPublic: true },
    });
    await expect(service.updateGroup('social', { whatsapp: '' }, 1n, meta))
      .resolves.toEqual({ whatsapp: '' });
    await expect(service.updateGroup('social', { whatsapp: 'javascript:alert(1)' }, 1n, meta))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
