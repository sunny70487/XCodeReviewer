/**
 * LLM服務統一匯出
 */

// 型別定義
export type {
  LLMProvider,
  LLMConfig,
  LLMMessage,
  LLMRequest,
  LLMResponse,
  ILLMAdapter,
} from './types';

// 工具類
export { LLMError, DEFAULT_LLM_CONFIG, DEFAULT_MODELS, DEFAULT_BASE_URLS } from './types';
export { BaseLLMAdapter } from './base-adapter';

// 介面卡
export * from './adapters';

// 工廠和服務
export { LLMFactory } from './llm-factory';
export { LLMService, createLLMService, getDefaultLLMService } from './llm-service';

