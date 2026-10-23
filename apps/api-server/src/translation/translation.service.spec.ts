import { ServiceUnavailableException } from '@nestjs/common';
import { TranslationService } from './translation.service';

function createService(options?: {
  apiKey?: string;
  stored?: Record<string, string>;
}): TranslationService {
  const apiKey = options?.apiKey ?? 'environment-key';
  return new TranslationService(
    {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'OPENAI_API_KEY') return apiKey;
        return fallback;
      }),
    } as never,
    {
      translationModelSettings: jest.fn().mockResolvedValue(options?.stored ?? {}),
    } as never,
  );
}

describe('TranslationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the saved OpenAI-compatible configuration', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          name: { en: 'Toyota Camry', ru: 'Toyota Camry' },
        }) } }],
      }),
    } as Response);

    await expect(createService({
      stored: {
        protocol: 'openai',
        baseUrl: 'https://gateway.example/v1',
        apiKey: 'stored-key',
        model: 'translation-model',
      },
    }).translateChineseFields({ name: '丰田凯美瑞' })).resolves.toEqual({
      name: { en: 'Toyota Camry', ru: 'Toyota Camry' },
    });

    const requestOptions = fetchMock.mock.calls[0]?.[1];
    expect(requestOptions?.method).toBe('POST');
    expect(requestOptions?.headers).toMatchObject({ Authorization: 'Bearer stored-key' });
  });

  it('uses the Anthropic-compatible messages endpoint and headers', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify({
          name: { en: 'Toyota', ru: 'Toyota' },
        }) }],
      }),
    } as Response);

    await expect(createService({
      stored: {
        protocol: 'anthropic',
        baseUrl: 'https://anthropic.example',
        apiKey: 'anthropic-key',
        model: 'claude-model',
      },
    }).translateChineseFields({ name: '丰田' })).resolves.toEqual({
      name: { en: 'Toyota', ru: 'Toyota' },
    });

    const requestOptions = fetchMock.mock.calls[0]?.[1];
    expect(requestOptions?.method).toBe('POST');
    expect(requestOptions?.headers).toMatchObject({ 'x-api-key': 'anthropic-key' });
  });

  it('uses the environment configuration when no saved API key exists', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          name: { en: 'Toyota', ru: 'Toyota' },
        }) } }],
      }),
    } as Response);

    await createService().translateChineseFields({ name: '丰田' });

    const requestOptions = fetchMock.mock.calls[0]?.[1];
    expect(requestOptions?.headers).toMatchObject({ Authorization: 'Bearer environment-key' });
  });

  it('retries only fields omitted from an incomplete batch response', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            name: { en: 'Toyota', ru: 'Тойота' },
          }) } }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            shortDescription: { en: 'Comfortable sedan', ru: 'Комфортный седан' },
          }) } }],
        }),
      } as Response);

    await expect(createService().translateChineseFields({
      name: '丰田',
      shortDescription: '舒适轿车',
    })).resolves.toEqual({
      name: { en: 'Toyota', ru: 'Тойота' },
      shortDescription: { en: 'Comfortable sedan', ru: 'Комфортный седан' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryRequest = fetchMock.mock.calls[1]!;
    const retryOptions = retryRequest[1] as RequestInit;
    const retryBody = retryOptions.body;
    expect(typeof retryBody).toBe('string');
    if (typeof retryBody !== 'string') return;
    const parsedRetryBody: unknown = JSON.parse(retryBody);
    if (!parsedRetryBody || typeof parsedRetryBody !== 'object' || !('messages' in parsedRetryBody)) {
      throw new Error('Retry request has no messages');
    }
    expect(parsedRetryBody.messages).toContainEqual({
      role: 'user',
      content: JSON.stringify({ shortDescription: '舒适轿车' }),
    });
  });

  it('reports a configuration error before issuing a request without an API key', async () => {
    await expect(createService({ apiKey: '' }).translateChineseFields({ name: '丰田' }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
