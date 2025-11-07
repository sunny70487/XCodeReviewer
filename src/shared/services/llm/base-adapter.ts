/**
 * LLM介面卡基類
 */

import type { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLMProvider } from './types';
import { LLMError, DEFAULT_LLM_CONFIG } from './types';

export abstract class BaseLLMAdapter implements ILLMAdapter {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = {
      ...DEFAULT_LLM_CONFIG,
      ...config,
    };
  }

  abstract complete(request: LLMRequest): Promise<LLMResponse>;

  getProvider(): LLMProvider {
    return this.config.provider;
  }

  getModel(): string {
    return this.config.model;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      throw new LLMError(
        'API Key未配置',
        this.config.provider
      );
    }
    return true;
  }

  /**
   * 處理超時
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = this.config.timeout || 150000
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new LLMError(
          `請求超時 (${timeoutMs}ms)`,
          this.config.provider
        )), timeoutMs)
      ),
    ]);
  }

  /**
   * 處理API錯誤
   */
  protected handleError(error: any, context?: string): never {
    let message = error.message || error;
    
    // 針對不同錯誤型別提供更詳細的資訊
    if (error.name === 'AbortError' || message.includes('超時')) {
      message = `請求超時 (${this.config.timeout}ms)。建議：\n` +
        `1. 檢查網路連線是否正常\n` +
        `2. 嘗試增加超時時間（在.env中設定 VITE_LLM_TIMEOUT）\n` +
        `3. 驗證API端點是否正確`;
    } else if (error.statusCode === 401 || error.statusCode === 403) {
      message = `API認證失敗。建議：\n` +
        `1. 檢查API Key是否正確配置\n` +
        `2. 確認API Key是否有效且未過期\n` +
        `3. 驗證API Key許可權是否充足`;
    } else if (error.statusCode === 429) {
      message = `API呼叫頻率超限。建議：\n` +
        `1. 等待一段時間後重試\n` +
        `2. 降低併發數（VITE_LLM_CONCURRENCY）\n` +
        `3. 增加請求間隔（VITE_LLM_GAP_MS）`;
    } else if (error.statusCode >= 500) {
      message = `API服務異常 (${error.statusCode})。建議：\n` +
        `1. 稍後重試\n` +
        `2. 檢查服務商狀態頁面\n` +
        `3. 嘗試切換其他LLM提供商`;
    }

    const fullMessage = context ? `${context}: ${message}` : message;

    throw new LLMError(
      fullMessage,
      this.config.provider,
      error.statusCode || error.status,
      error
    );
  }

  /**
   * 重試邏輯
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // 如果是4xx錯誤（客戶端錯誤），不重試
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // 最後一次嘗試時不等待
        if (attempt < maxAttempts - 1) {
          // 指數退避
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 構建請求頭
   */
  protected buildHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
  }
}

