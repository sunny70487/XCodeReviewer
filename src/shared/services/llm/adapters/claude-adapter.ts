/**
 * Anthropic Claude介面卡
 */

import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class ClaudeAdapter extends BaseLLMAdapter {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      await this.validateConfig();

      return await this.retry(async () => {
        return await this.withTimeout(this._sendRequest(request));
      });
    } catch (error) {
      this.handleError(error, 'Claude API呼叫失敗');
    }
  }

  private async _sendRequest(request: LLMRequest): Promise<LLMResponse> {
    // Claude API需要將system訊息分離
    const systemMessage = request.messages.find(msg => msg.role === 'system');
    const messages = request.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

    const requestBody: any = {
      model: this.config.model,
      messages,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      temperature: request.temperature ?? this.config.temperature,
      top_p: request.topP ?? this.config.topP,
    };

    if (systemMessage) {
      requestBody.system = systemMessage.content;
    }

    // 構建請求頭
    const headers: Record<string, string> = {
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };

    // 合併自定義請求頭
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: this.buildHeaders(headers),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        message: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (!data.content || !data.content[0]) {
      throw new Error('API響應格式異常: 缺少content欄位');
    }

    return {
      content: data.content[0].text || '',
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      finishReason: data.stop_reason,
    };
  }

  async validateConfig(): Promise<boolean> {
    await super.validateConfig();
    
    if (!this.config.model.startsWith('claude-')) {
      throw new Error(`無效的Claude模型: ${this.config.model}`);
    }
    
    return true;
  }
}

