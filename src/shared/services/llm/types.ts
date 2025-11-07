/**
 * LLM服務型別定義
 */

// 支援的LLM提供商型別
export type LLMProvider = 
  | 'gemini'      // Google Gemini
  | 'openai'      // OpenAI (GPT系列)
  | 'claude'      // Anthropic Claude
  | 'qwen'        // 阿里雲通義千問
  | 'deepseek'    // DeepSeek
  | 'zhipu'       // 智譜AI (GLM系列)
  | 'moonshot'    // 月之暗面 Kimi
  | 'baidu'       // 百度文心一言
  | 'minimax'     // MiniMax
  | 'doubao'      // 位元組豆包
  | 'ollama';     // Ollama 本地大模型

// LLM配置介面
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;          // 自定義API端點
  timeout?: number;          // 超時時間(ms)
  temperature?: number;      // 溫度引數
  maxTokens?: number;        // 最大token數
  topP?: number;            // Top-p取樣
  frequencyPenalty?: number; // 頻率懲罰
  presencePenalty?: number;  // 存在懲罰
  customHeaders?: Record<string, string>; // 自定義請求頭
}

// LLM請求訊息
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// LLM請求引數
export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

// LLM響應
export interface LLMResponse {
  content: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

// LLM介面卡介面
export interface ILLMAdapter {
  /**
   * 傳送請求並獲取響應
   */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * 流式響應（可選）
   */
  streamComplete?(request: LLMRequest): AsyncGenerator<string, void, unknown>;

  /**
   * 獲取提供商名稱
   */
  getProvider(): LLMProvider;

  /**
   * 獲取模型名稱
   */
  getModel(): string;

  /**
   * 驗證配置是否有效
   */
  validateConfig(): Promise<boolean>;
}

// 錯誤型別
export class LLMError extends Error {
  constructor(
    message: string,
    public provider: LLMProvider,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// 預設配置
export const DEFAULT_LLM_CONFIG: Partial<LLMConfig> = {
  timeout: 150000,
  temperature: 0.2,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

// 各平臺預設模型
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-20241022',
  qwen: 'qwen-turbo',
  deepseek: 'deepseek-chat',
  zhipu: 'glm-4-flash',
  moonshot: 'moonshot-v1-8k',
  baidu: 'ERNIE-3.5-8K',
  minimax: 'abab6.5-chat',
  doubao: 'doubao-pro-32k',
  ollama: 'llama3',
};

// 各平臺API端點
export const DEFAULT_BASE_URLS: Partial<Record<LLMProvider, string>> = {
  openai: 'https://api.openai.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/api/v1',
  deepseek: 'https://api.deepseek.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  moonshot: 'https://api.moonshot.cn/v1',
  baidu: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
  minimax: 'https://api.minimax.chat/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  ollama: 'http://localhost:11434/v1',
};

