/**
 * Ollama介面卡 - 支援本地執行的開源大模型
 * Ollama使用OpenAI相容的API格式
 */

import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class OllamaAdapter extends BaseLLMAdapter {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434/v1';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Ollama 不強制要求 API Key，但仍然驗證配置
      await this.validateConfig();

      return await this.retry(async () => {
        return await this.withTimeout(this._sendRequest(request));
      });
    } catch (error) {
      this.handleError(error, 'Ollama API呼叫失敗');
    }
  }

  private async _sendRequest(request: LLMRequest): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 如果配置了 API Key，則新增到請求頭（某些 Ollama 部署可能需要）
    if (this.config.apiKey && this.config.apiKey !== 'ollama') {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    // 合併自定義請求頭
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: this.buildHeaders(headers),
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        top_p: request.topP ?? this.config.topP,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        message: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('API響應格式異常: 缺少choices欄位');
    }

    return {
      content: choice.message?.content || '',
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined,
      finishReason: choice.finish_reason,
    };
  }

  /**
   * Ollama 不強制要求 API Key
   * 可以使用任意字串作為佔位符，或者不設定
   */
  async validateConfig(): Promise<boolean> {
    if (!this.config.model) {
      throw new Error('未指定Ollama模型');
    }

    // Ollama 本地執行不需要驗證 API Key
    // 但如果配置了，我們保持相容性
    return true;
  }
}

