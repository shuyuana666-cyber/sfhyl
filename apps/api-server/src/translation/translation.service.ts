import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SettingsService,
  type TranslationProtocol,
} from '../settings/settings.service';

export interface TranslationPair {
  en: string;
  ru: string;
}

interface TranslationConfiguration {
  protocol: TranslationProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
}

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
};

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

const TRANSLATION_REQUEST_TIMEOUT_MS = 90_000;
const TRANSLATION_MAX_TOKENS = 16_384;

@Injectable()
export class TranslationService {
  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async translateChineseFields(
    fields: Record<string, string | null | undefined>,
  ): Promise<Record<string, TranslationPair>> {
    const entries: Array<[string, string]> = [];
    for (const [name, value] of Object.entries(fields)) {
      if (value?.trim()) entries.push([name, value]);
    }
    if (!entries.length) return {};

    const configuration = await this.translationConfiguration();
    if (!configuration.apiKey) {
      throw new ServiceUnavailableException('Automatic translation is not configured.');
    }

    const names = entries.map(([name]) => name);
    const instructions = [
      'Translate the provided Chinese values into English and Russian.',
      'Keep vehicle model codes, VIN-like text, numbers, URLs, placeholders, and punctuation accurate.',
      'For HTML values, preserve HTML elements, attributes, URLs, and media references while translating only visible text.',
      'Return JSON only. Return every requested field exactly once as an object with en and ru string values.',
    ].join(' ');

    const initial = await this.requestTranslation(
      configuration,
      instructions,
      Object.fromEntries(entries),
    );
    const result = this.parseResult(initial);
    const missing = names.filter((name) => !this.isTranslationPair(result?.[name]));
    if (!missing.length && result) return result;

    // Long descriptions can cause a model to finish its response before all fields are emitted.
    // Retry only missing fields so a valid translation is never discarded or partially persisted.
    const completed: Record<string, TranslationPair> = result ?? {};
    for (const name of missing) {
      const value = fields[name];
      if (!value?.trim()) continue;
      const retry = this.parseResult(await this.requestTranslation(
        configuration,
        instructions,
        { [name]: value },
      ));
      if (this.isTranslationPair(retry?.[name])) completed[name] = retry[name];
    }

    if (!this.isValidResult(completed, names)) {
      throw new ServiceUnavailableException('Automatic translation returned an incomplete result.');
    }
    return completed;
  }

  private async translationConfiguration(): Promise<TranslationConfiguration> {
    const stored = await this.settings.translationModelSettings();
    const envProtocol = this.config.get<string>('OPENAI_TRANSLATION_PROTOCOL', 'openai');

    return {
      protocol: stored.protocol ?? (envProtocol === 'anthropic' ? 'anthropic' : 'openai'),
      baseUrl: stored.baseUrl ?? this.config.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      apiKey: stored.apiKey ?? this.config.get<string>('OPENAI_API_KEY', '').trim(),
      model: stored.model ?? this.config.get<string>('OPENAI_TRANSLATION_MODEL', 'gpt-4o-mini'),
    };
  }

  private async requestOpenAi(
    configuration: TranslationConfiguration,
    instructions: string,
    source: string,
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.openAiEndpoint(configuration.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: configuration.model,
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: source },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: TRANSLATION_MAX_TOKENS,
        }),
        signal: AbortSignal.timeout(TRANSLATION_REQUEST_TIMEOUT_MS),
      });
    } catch {
      this.translationUnavailable();
    }

    if (!response.ok) this.translationUnavailable();
    let data: OpenAiChatResponse;
    try {
      data = await response.json() as OpenAiChatResponse;
    } catch {
      this.translationUnavailable();
    }
    const content = data.choices?.[0]?.message?.content;
    const text = typeof content === 'string'
      ? content
      : content?.map((item) => item.text ?? '').join('');
    if (!text) this.translationUnavailable();
    return text;
  }

  private async requestAnthropic(
    configuration: TranslationConfiguration,
    instructions: string,
    source: string,
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.anthropicEndpoint(configuration.baseUrl), {
        method: 'POST',
        headers: {
          'x-api-key': configuration.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: configuration.model,
          max_tokens: TRANSLATION_MAX_TOKENS,
          temperature: 0,
          system: instructions,
          messages: [{ role: 'user', content: source }],
        }),
        signal: AbortSignal.timeout(TRANSLATION_REQUEST_TIMEOUT_MS),
      });
    } catch {
      this.translationUnavailable();
    }

    if (!response.ok) this.translationUnavailable();
    let data: AnthropicResponse;
    try {
      data = await response.json() as AnthropicResponse;
    } catch {
      this.translationUnavailable();
    }
    const text = data.content
      ?.filter((item) => item.type === 'text')
      .map((item) => item.text ?? '')
      .join('');
    if (!text) this.translationUnavailable();
    return text;
  }

  private openAiEndpoint(baseUrl: string): string {
    const base = this.trimTrailingSlash(baseUrl);
    return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  }

  private anthropicEndpoint(baseUrl: string): string {
    const base = this.trimTrailingSlash(baseUrl);
    if (base.endsWith('/v1/messages')) return base;
    return base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`;
  }

  private trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }

  private translationUnavailable(): never {
    throw new ServiceUnavailableException('Automatic translation is temporarily unavailable.');
  }

  private async requestTranslation(
    configuration: TranslationConfiguration,
    instructions: string,
    fields: Record<string, string>,
  ): Promise<string> {
    const source = JSON.stringify(fields);
    return configuration.protocol === 'anthropic'
      ? this.requestAnthropic(configuration, instructions, source)
      : this.requestOpenAi(configuration, instructions, source);
  }

  private parseResult(text: string): Record<string, TranslationPair> | null {
    const normalized = text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    try {
      const result: unknown = JSON.parse(normalized);
      if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
      return result as Record<string, TranslationPair>;
    } catch {
      return null;
    }
  }

  private isTranslationPair(value: unknown): value is TranslationPair {
    return Boolean(value)
      && typeof value === 'object'
      && typeof (value as TranslationPair).en === 'string'
      && Boolean((value as TranslationPair).en.trim())
      && typeof (value as TranslationPair).ru === 'string'
      && Boolean((value as TranslationPair).ru.trim());
  }

  private isValidResult(value: unknown, names: string[]): value is Record<string, TranslationPair> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return names.every((name) => {
      return this.isTranslationPair((value as Record<string, unknown>)[name]);
    });
  }
}
