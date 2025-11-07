/**
 * LLM服務 - 統一的LLM呼叫介面
 */

import type { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse } from './types';
import { LLMFactory } from './llm-factory';
import { env } from '@/shared/config/env';

/**
 * LLM服務類
 */
export class LLMService {
  private adapter: ILLMAdapter;

  constructor(config: LLMConfig) {
    this.adapter = LLMFactory.createAdapter(config);
  }

  /**
   * 傳送請求
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    return await this.adapter.complete(request);
  }

  /**
   * 簡單的文字補全
   */
  async simpleComplete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: any[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.adapter.complete({ messages });
    return response.content;
  }

  /**
   * 驗證配置
   */
  async validateConfig(): Promise<boolean> {
    return await this.adapter.validateConfig();
  }

  /**
   * 獲取提供商
   */
  getProvider() {
    return this.adapter.getProvider();
  }

  /**
   * 獲取模型
   */
  getModel() {
    return this.adapter.getModel();
  }

  /**
   * 從環境變數建立預設例項
   */
  static createFromEnv(): LLMService {
    const provider = env.LLM_PROVIDER as any || 'gemini';
    const apiKey = env.LLM_API_KEY || env.GEMINI_API_KEY;
    const model = env.LLM_MODEL || env.GEMINI_MODEL;

    if (!apiKey) {
      throw new Error('未配置LLM API Key，請在環境變數中設定');
    }

    // 獲取 baseUrl，優先使用通用配置，然後是平臺專用配置
    let baseUrl = env.LLM_BASE_URL;
    if (!baseUrl && provider === 'openai') {
      baseUrl = env.OPENAI_BASE_URL;
    } else if (!baseUrl && provider === 'ollama') {
      baseUrl = env.OLLAMA_BASE_URL;
    }

    // 解析自定義請求頭
    let customHeaders: Record<string, string> | undefined;
    if (env.LLM_CUSTOM_HEADERS) {
      try {
        customHeaders = JSON.parse(env.LLM_CUSTOM_HEADERS);
      } catch (e) {
        console.warn('Invalid LLM_CUSTOM_HEADERS format, should be JSON string');
      }
    }

    const config: LLMConfig = {
      provider,
      apiKey,
      model,
      baseUrl,
      timeout: env.LLM_TIMEOUT || env.GEMINI_TIMEOUT_MS,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
      customHeaders,
    };

    return new LLMService(config);
  }
}

/**
 * 建立LLM服務例項的便捷函式
 */
export function createLLMService(config: LLMConfig): LLMService {
  return new LLMService(config);
}

/**
 * 獲取預設的LLM服務例項
 */
export function getDefaultLLMService(): LLMService {
  return LLMService.createFromEnv();
}

