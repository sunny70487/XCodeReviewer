/**
 * LLM工廠類 - 統一建立和管理LLM介面卡
 */

import type { ILLMAdapter, LLMConfig, LLMProvider } from './types';
import { DEFAULT_MODELS } from './types';
import {
  GeminiAdapter,
  OpenAIAdapter,
  ClaudeAdapter,
  QwenAdapter,
  DeepSeekAdapter,
  ZhipuAdapter,
  MoonshotAdapter,
  BaiduAdapter,
  MinimaxAdapter,
  DoubaoAdapter,
  OllamaAdapter,
} from './adapters';

/**
 * LLM工廠類
 */
export class LLMFactory {
  private static adapters: Map<string, ILLMAdapter> = new Map();

  /**
   * 建立LLM介面卡例項
   */
  static createAdapter(config: LLMConfig): ILLMAdapter {
    const cacheKey = this.getCacheKey(config);
    
    // 從快取中獲取
    if (this.adapters.has(cacheKey)) {
      return this.adapters.get(cacheKey)!;
    }

    // 建立新的介面卡例項
    const adapter = this.instantiateAdapter(config);
    
    // 快取例項
    this.adapters.set(cacheKey, adapter);
    
    return adapter;
  }

  /**
   * 根據提供商型別例項化介面卡
   */
  private static instantiateAdapter(config: LLMConfig): ILLMAdapter {
    // 如果未指定模型，使用預設模型
    if (!config.model) {
      config.model = DEFAULT_MODELS[config.provider];
    }

    switch (config.provider) {
      case 'gemini':
        return new GeminiAdapter(config);
      
      case 'openai':
        return new OpenAIAdapter(config);
      
      case 'claude':
        return new ClaudeAdapter(config);
      
      case 'qwen':
        return new QwenAdapter(config);
      
      case 'deepseek':
        return new DeepSeekAdapter(config);
      
      case 'zhipu':
        return new ZhipuAdapter(config);
      
      case 'moonshot':
        return new MoonshotAdapter(config);
      
      case 'baidu':
        return new BaiduAdapter(config);
      
      case 'minimax':
        return new MinimaxAdapter(config);
      
      case 'doubao':
        return new DoubaoAdapter(config);
      
      case 'ollama':
        return new OllamaAdapter(config);
      
      default:
        throw new Error(`不支援的LLM提供商: ${config.provider}`);
    }
  }

  /**
   * 生成快取鍵
   */
  private static getCacheKey(config: LLMConfig): string {
    return `${config.provider}:${config.model}:${config.apiKey.substring(0, 8)}`;
  }

  /**
   * 清除快取
   */
  static clearCache(): void {
    this.adapters.clear();
  }

  /**
   * 獲取支援的提供商列表
   */
  static getSupportedProviders(): LLMProvider[] {
    return [
      'gemini',
      'openai',
      'claude',
      'qwen',
      'deepseek',
      'zhipu',
      'moonshot',
      'baidu',
      'minimax',
      'doubao',
      'ollama',
    ];
  }

  /**
   * 獲取提供商的預設模型
   */
  static getDefaultModel(provider: LLMProvider): string {
    return DEFAULT_MODELS[provider];
  }

  /**
   * 獲取提供商的可用模型列表
   */
  static getAvailableModels(provider: LLMProvider): string[] {
    const models: Record<LLMProvider, string[]> = {
      gemini: [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
      ],
      openai: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
      ],
      claude: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ],
      qwen: [
        'qwen-turbo',
        'qwen-plus',
        'qwen-max',
        'qwen-max-longcontext',
      ],
      deepseek: [
        'deepseek-chat',
        'deepseek-coder',
      ],
      zhipu: [
        'glm-4-flash',
        'glm-4',
        'glm-4-air',
        'glm-3-turbo',
      ],
      moonshot: [
        'moonshot-v1-8k',
        'moonshot-v1-32k',
        'moonshot-v1-128k',
      ],
      baidu: [
        'ERNIE-4.0-8K',
        'ERNIE-3.5-8K',
        'ERNIE-3.5-128K',
        'ERNIE-Speed-8K',
        'ERNIE-Speed-128K',
        'ERNIE-Lite-8K',
        'ERNIE-Tiny-8K',
      ],
      minimax: [
        'abab6.5-chat',
        'abab6.5s-chat',
        'abab5.5-chat',
      ],
      doubao: [
        'doubao-pro-32k',
        'doubao-pro-128k',
        'doubao-lite-32k',
        'doubao-lite-128k',
      ],
      ollama: [
        'llama3',
        'llama3.1',
        'llama3.2',
        'mistral',
        'codellama',
        'qwen2.5',
        'gemma2',
        'phi3',
        'deepseek-coder',
      ],
    };

    return models[provider] || [];
  }

  /**
   * 獲取提供商的友好名稱
   */
  static getProviderDisplayName(provider: LLMProvider): string {
    const names: Record<LLMProvider, string> = {
      gemini: 'Google Gemini',
      openai: 'OpenAI GPT',
      claude: 'Anthropic Claude',
      qwen: '阿里雲通義千問',
      deepseek: 'DeepSeek',
      zhipu: '智譜AI (GLM)',
      moonshot: '月之暗面 Kimi',
      baidu: '百度文心一言',
      minimax: 'MiniMax',
      doubao: '位元組豆包',
      ollama: 'Ollama 本地大模型',
    };

    return names[provider] || provider;
  }
}

