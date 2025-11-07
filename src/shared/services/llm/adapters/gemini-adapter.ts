/**
 * Google Gemini介面卡 - 支援官方API和中轉站
 */

import { BaseLLMAdapter } from '../base-adapter';
import type { LLMRequest, LLMResponse } from '../types';

export class GeminiAdapter extends BaseLLMAdapter {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    // 支援自定義baseUrl（中轉站）或使用官方API
    this.baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      await this.validateConfig();

      return await this.retry(async () => {
        return await this.withTimeout(this._generateContent(request));
      });
    } catch (error) {
      this.handleError(error, 'Gemini API呼叫失敗');
    }
  }

  private async _generateContent(request: LLMRequest): Promise<LLMResponse> {
    // 轉換訊息格式為 Gemini 格式
    const contents = request.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // 將系統訊息合併到第一條使用者訊息
    const systemMessage = request.messages.find(msg => msg.role === 'system');
    if (systemMessage && contents.length > 0) {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    // 構建請求體
    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature,
        topP: request.topP ?? this.config.topP,
      }
    };

    // maxOutputTokens: 如果設置為 0 或負數，則不傳遞（讓模型自行決定）
    const maxTokens = request.maxTokens ?? this.config.maxTokens;
    if (maxTokens && maxTokens > 0) {
      requestBody.generationConfig.maxOutputTokens = maxTokens;
    } else if (maxTokens === undefined || maxTokens === null) {
      // 如果完全未設置，使用一個較大的默認值以避免被過早截斷
      requestBody.generationConfig.maxOutputTokens = 8192;
    }
    // 如果 maxTokens <= 0，不設置此參數，讓模型輸出盡可能多的內容

    // 構建請求頭
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 如果有自定義請求頭，合並進去
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders);
    }

    // API Key 可能在 URL 引數或請求頭中
    const url = `${this.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(headers),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        statusCode: response.status,
        message: error.error?.message || `HTTP ${response.status}: ${response.statusText}`,
        details: error,
      };
    }

    const data = await response.json();
    
    // 解析 Gemini 響應格式
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content) {
      throw new Error('API響應格式異常: 缺少candidates或content欄位');
    }

    const text = candidate.content.parts?.map((part: any) => part.text).join('') || '';

    return {
      content: text,
      model: this.config.model,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
      finishReason: candidate.finishReason || 'stop',
    };
  }

  async validateConfig(): Promise<boolean> {
    await super.validateConfig();
    
    if (!this.config.model.startsWith('gemini-')) {
      throw new Error(`無效的Gemini模型: ${this.config.model}`);
    }
    
    return true;
  }
}
