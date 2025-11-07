import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Info,
  Key,
  Zap,
  Globe,
  Database
} from "lucide-react";
import { toast } from "sonner";

// LLM 提供商配置
const LLM_PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini', icon: '🔵', category: 'international' },
  { value: 'openai', label: 'OpenAI GPT', icon: '🟢', category: 'international' },
  { value: 'claude', label: 'Anthropic Claude', icon: '🟣', category: 'international' },
  { value: 'deepseek', label: 'DeepSeek', icon: '🔷', category: 'international' },
  { value: 'qwen', label: '阿里雲通義千問', icon: '🟠', category: 'domestic' },
  { value: 'zhipu', label: '智譜AI (GLM)', icon: '🔴', category: 'domestic' },
  { value: 'moonshot', label: 'Moonshot (Kimi)', icon: '🌙', category: 'domestic' },
  { value: 'baidu', label: '百度文心一言', icon: '🔵', category: 'domestic' },
  { value: 'minimax', label: 'MiniMax', icon: '⚡', category: 'domestic' },
  { value: 'doubao', label: '位元組豆包', icon: '🎯', category: 'domestic' },
  { value: 'ollama', label: 'Ollama 本地模型', icon: '🖥️', category: 'local' },
];

// 預設模型配置
const DEFAULT_MODELS = {
  gemini: 'gemini-1.5-flash',
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

interface SystemConfigData {
  // LLM 配置
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string;
  llmTimeout: number;
  llmTemperature: number;
  llmMaxTokens: number;
  llmCustomHeaders: string;

  // 平臺專用配置
  geminiApiKey: string;
  openaiApiKey: string;
  claudeApiKey: string;
  qwenApiKey: string;
  deepseekApiKey: string;
  zhipuApiKey: string;
  moonshotApiKey: string;
  baiduApiKey: string;
  minimaxApiKey: string;
  doubaoApiKey: string;
  ollamaBaseUrl: string;

  // GitHub 配置
  githubToken: string;

  // GitLab 配置
  gitlabToken: string;

  // 分析配置
  maxAnalyzeFiles: number;
  llmConcurrency: number;
  llmGapMs: number;
  outputLanguage: string;
}

const STORAGE_KEY = 'xcodereviewer_runtime_config';

export function SystemConfig() {
  const [config, setConfig] = useState<SystemConfigData>({
    llmProvider: 'gemini',
    llmApiKey: '',
    llmModel: '',
    llmBaseUrl: '',
    llmTimeout: 150000,
    llmTemperature: 0.2,
    llmMaxTokens: 4096,
    llmCustomHeaders: '',
    geminiApiKey: '',
    openaiApiKey: '',
    claudeApiKey: '',
    qwenApiKey: '',
    deepseekApiKey: '',
    zhipuApiKey: '',
    moonshotApiKey: '',
    baiduApiKey: '',
    minimaxApiKey: '',
    doubaoApiKey: '',
    ollamaBaseUrl: 'http://localhost:11434/v1',
    githubToken: '',
    gitlabToken: '',
    maxAnalyzeFiles: 40,
    llmConcurrency: 2,
    llmGapMs: 500,
    outputLanguage: 'zh-CN',
  });

  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [configSource, setConfigSource] = useState<'runtime' | 'build'>('build');

  // 載入配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    try {
      // 嘗試從 localStorage 載入執行時配置
      const savedConfig = localStorage.getItem(STORAGE_KEY);

      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
        setConfigSource('runtime');
        console.log('已載入執行時配置');
      } else {
        // 使用構建時配置
        loadFromEnv();
        setConfigSource('build');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      loadFromEnv();
    }
  };

  const loadFromEnv = () => {
    // 從環境變數載入（構建時配置）
    const envConfig: SystemConfigData = {
      llmProvider: import.meta.env.VITE_LLM_PROVIDER || 'gemini',
      llmApiKey: import.meta.env.VITE_LLM_API_KEY || '',
      llmModel: import.meta.env.VITE_LLM_MODEL || '',
      llmBaseUrl: import.meta.env.VITE_LLM_BASE_URL || '',
      llmTimeout: Number(import.meta.env.VITE_LLM_TIMEOUT) || 150000,
      llmTemperature: Number(import.meta.env.VITE_LLM_TEMPERATURE) || 0.2,
      llmMaxTokens: Number(import.meta.env.VITE_LLM_MAX_TOKENS) || 4096,
      llmCustomHeaders: import.meta.env.VITE_LLM_CUSTOM_HEADERS || '',
      geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
      openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
      claudeApiKey: import.meta.env.VITE_CLAUDE_API_KEY || '',
      qwenApiKey: import.meta.env.VITE_QWEN_API_KEY || '',
      deepseekApiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
      zhipuApiKey: import.meta.env.VITE_ZHIPU_API_KEY || '',
      moonshotApiKey: import.meta.env.VITE_MOONSHOT_API_KEY || '',
      baiduApiKey: import.meta.env.VITE_BAIDU_API_KEY || '',
      minimaxApiKey: import.meta.env.VITE_MINIMAX_API_KEY || '',
      doubaoApiKey: import.meta.env.VITE_DOUBAO_API_KEY || '',
      ollamaBaseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      githubToken: import.meta.env.VITE_GITHUB_TOKEN || '',
      gitlabToken: import.meta.env.VITE_GITLAB_TOKEN || '',
      maxAnalyzeFiles: Number(import.meta.env.VITE_MAX_ANALYZE_FILES) || 40,
      llmConcurrency: Number(import.meta.env.VITE_LLM_CONCURRENCY) || 2,
      llmGapMs: Number(import.meta.env.VITE_LLM_GAP_MS) || 500,
      outputLanguage: import.meta.env.VITE_OUTPUT_LANGUAGE || 'zh-CN',
    };
    setConfig(envConfig);
  };

  const saveConfig = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setHasChanges(false);
      setConfigSource('runtime');

      // 記錄使用者操作
      import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
        logger.logUserAction('儲存系統配置', {
          provider: config.llmProvider,
          hasApiKey: !!config.llmApiKey,
          maxFiles: config.maxAnalyzeFiles,
          concurrency: config.llmConcurrency,
          language: config.outputLanguage,
        });
      });

      toast.success("配置已儲存！重新整理頁面後生效");

      // 提示使用者重新整理頁面
      setTimeout(() => {
        if (window.confirm("配置已儲存。是否立即重新整理頁面使配置生效？")) {
          window.location.reload();
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to save config:', error);

      // 記錄錯誤並顯示詳細資訊
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '儲存系統配置失敗');
      });

      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      toast.error(`儲存配置失敗: ${errorMessage}`);
    }
  };

  const resetConfig = () => {
    if (window.confirm("確定要重置為構建時配置嗎？這將清除所有執行時配置。")) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        loadFromEnv();
        setHasChanges(false);
        setConfigSource('build');

        // 記錄使用者操作
        import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
          logger.logUserAction('重置系統配置', { action: 'reset_to_build_config' });
        });

        toast.success("已重置為構建時配置");
      } catch (error) {
        console.error('Failed to reset config:', error);

        // 記錄錯誤並顯示詳細資訊
        import('@/shared/utils/errorHandler').then(({ handleError }) => {
          handleError(error, '重置系統配置失敗');
        });

        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        toast.error(`重置配置失敗: ${errorMessage}`);
      }
    }
  };

  const updateConfig = (key: keyof SystemConfigData, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const toggleShowApiKey = (field: string) => {
    setShowApiKeys(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const getCurrentApiKey = () => {
    const provider = config.llmProvider.toLowerCase();
    const keyMap: Record<string, string> = {
      gemini: config.geminiApiKey,
      openai: config.openaiApiKey,
      claude: config.claudeApiKey,
      qwen: config.qwenApiKey,
      deepseek: config.deepseekApiKey,
      zhipu: config.zhipuApiKey,
      moonshot: config.moonshotApiKey,
      baidu: config.baiduApiKey,
      minimax: config.minimaxApiKey,
      doubao: config.doubaoApiKey,
      ollama: 'ollama',
    };

    return config.llmApiKey || keyMap[provider] || '';
  };

  const isConfigured = getCurrentApiKey() !== '';

  return (
    <div className="space-y-6">
      {/* 配置狀態提示 */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong>當前配置來源：</strong>
            {configSource === 'runtime' ? (
              <Badge variant="default" className="ml-2">執行時配置</Badge>
            ) : (
              <Badge variant="outline" className="ml-2">構建時配置</Badge>
            )}
            <span className="ml-4 text-sm">
              {isConfigured ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> LLM 已配置
                </span>
              ) : (
                <span className="text-orange-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> 未配置 LLM
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button onClick={saveConfig} size="sm">
                <Save className="w-4 h-4 mr-2" />
                儲存配置
              </Button>
            )}
            {configSource === 'runtime' && (
              <Button onClick={resetConfig} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                重置
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="llm" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="llm">
            <Zap className="w-4 h-4 mr-2" />
            LLM 配置
          </TabsTrigger>
          <TabsTrigger value="platforms">
            <Key className="w-4 h-4 mr-2" />
            平臺金鑰
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <Settings className="w-4 h-4 mr-2" />
            分析引數
          </TabsTrigger>
          <TabsTrigger value="other">
            <Globe className="w-4 h-4 mr-2" />
            其他配置
          </TabsTrigger>
        </TabsList>

        {/* LLM 基礎配置 */}
        <TabsContent value="llm" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>LLM 提供商配置</CardTitle>
              <CardDescription>選擇和配置大語言模型服務</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>當前使用的 LLM 提供商</Label>
                <Select
                  value={config.llmProvider}
                  onValueChange={(value) => updateConfig('llmProvider', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">國際平臺</div>
                    {LLM_PROVIDERS.filter(p => p.category === 'international').map(provider => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.icon} {provider.label}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground mt-2">國內平臺</div>
                    {LLM_PROVIDERS.filter(p => p.category === 'domestic').map(provider => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.icon} {provider.label}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground mt-2">本地部署</div>
                    {LLM_PROVIDERS.filter(p => p.category === 'local').map(provider => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.icon} {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>通用 API Key（可選）</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys['llm'] ? 'text' : 'password'}
                    value={config.llmApiKey}
                    onChange={(e) => updateConfig('llmApiKey', e.target.value)}
                    placeholder="留空則使用平臺專用 API Key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey('llm')}
                  >
                    {showApiKeys['llm'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  如果設定，將優先使用此 API Key；否則使用下方對應平臺的專用 API Key
                </p>
              </div>

              <div className="space-y-2">
                <Label>模型名稱（可選）</Label>
                <Input
                  value={config.llmModel}
                  onChange={(e) => updateConfig('llmModel', e.target.value)}
                  placeholder={`預設：${DEFAULT_MODELS[config.llmProvider as keyof typeof DEFAULT_MODELS] || '自動'}`}
                />
                <p className="text-xs text-muted-foreground">
                  留空使用預設模型
                </p>
              </div>

              <div className="space-y-2">
                <Label>API 基礎 URL（推薦配置）</Label>
                <Input
                  value={config.llmBaseUrl}
                  onChange={(e) => updateConfig('llmBaseUrl', e.target.value)}
                  placeholder="例如：https://api.example.com/v1"
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>💡 <strong>使用 API 中轉站？</strong>在這裡填入中轉站地址。配置儲存後會在實際使用時自動驗證。</p>
                  <details className="cursor-pointer">
                    <summary className="text-primary hover:underline">檢視常見 API 中轉示例</summary>
                    <div className="mt-2 p-3 bg-muted rounded space-y-1 text-xs">
                      <p><strong>OpenAI 相容格式：</strong></p>
                      <p>• https://your-proxy.com/v1</p>
                      <p>• https://api.openai-proxy.org/v1</p>
                      <p className="pt-2"><strong>其他中轉格式：</strong></p>
                      <p>• https://your-api-gateway.com/openai</p>
                      <p>• https://custom-endpoint.com/api</p>
                      <p className="pt-2 text-orange-600">⚠️ 確保中轉站支援你選擇的 LLM 平臺</p>
                    </div>
                  </details>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>超時時間（毫秒）</Label>
                  <Input
                    type="number"
                    value={config.llmTimeout}
                    onChange={(e) => updateConfig('llmTimeout', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>溫度引數（0-2）</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={config.llmTemperature}
                    onChange={(e) => updateConfig('llmTemperature', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最大 Tokens</Label>
                  <Input
                    type="number"
                    value={config.llmMaxTokens}
                    onChange={(e) => updateConfig('llmMaxTokens', Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>自定義請求頭（高階，可選）</Label>
                <Input
                  value={config.llmCustomHeaders}
                  onChange={(e) => updateConfig('llmCustomHeaders', e.target.value)}
                  placeholder='{"X-Custom-Header": "value", "Another-Header": "value2"}'
                />
                <p className="text-xs text-muted-foreground">
                  JSON 格式，用於某些中轉站或自建服務的特殊要求。例如：<code className="bg-muted px-1 py-0.5 rounded">&#123;"X-API-Version": "v1"&#125;</code>
                </p>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* 平臺專用金鑰 */}
        <TabsContent value="platforms" className="space-y-6">
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p>配置各平臺的 API Key，方便快速切換。如果設定了通用 API Key，將優先使用通用配置。</p>
                <p className="text-xs text-muted-foreground pt-1">
                  💡 <strong>使用 API 中轉站的使用者注意：</strong>這裡填入的應該是<strong>中轉站提供的 API Key</strong>，而不是官方 Key。
                  中轉站地址請在「LLM 配置」標籤頁的「API 基礎 URL」中填寫。
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {[
            { key: 'geminiApiKey', label: 'Google Gemini API Key', icon: '🔵', hint: '官方：https://makersuite.google.com/app/apikey | 或使用中轉站 Key' },
            { key: 'openaiApiKey', label: 'OpenAI API Key', icon: '🟢', hint: '官方：https://platform.openai.com/api-keys | 或使用中轉站 Key' },
            { key: 'claudeApiKey', label: 'Claude API Key', icon: '🟣', hint: '官方：https://console.anthropic.com/ | 或使用中轉站 Key' },
            { key: 'qwenApiKey', label: '通義千問 API Key', icon: '🟠', hint: '官方：https://dashscope.console.aliyun.com/ | 或使用中轉站 Key' },
            { key: 'deepseekApiKey', label: 'DeepSeek API Key', icon: '🔷', hint: '官方：https://platform.deepseek.com/ | 或使用中轉站 Key' },
            { key: 'zhipuApiKey', label: '智譜AI API Key', icon: '🔴', hint: '官方：https://open.bigmodel.cn/ | 或使用中轉站 Key' },
            { key: 'moonshotApiKey', label: 'Moonshot API Key', icon: '🌙', hint: '官方：https://platform.moonshot.cn/ | 或使用中轉站 Key' },
            { key: 'baiduApiKey', label: '百度文心 API Key', icon: '🔵', hint: '官方格式：API_KEY:SECRET_KEY | 或使用中轉站 Key' },
            { key: 'minimaxApiKey', label: 'MiniMax API Key', icon: '⚡', hint: '官方：https://www.minimaxi.com/ | 或使用中轉站 Key' },
            { key: 'doubaoApiKey', label: '位元組豆包 API Key', icon: '🎯', hint: '官方：https://console.volcengine.com/ark | 或使用中轉站 Key' },
          ].map(({ key, label, icon, hint }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{icon}</span>
                  {label}
                </CardTitle>
                <CardDescription className="text-xs">{hint}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys[key] ? 'text' : 'password'}
                    value={config[key as keyof SystemConfigData] as string}
                    onChange={(e) => updateConfig(key as keyof SystemConfigData, e.target.value)}
                    placeholder={`輸入 ${label}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey(key)}
                  >
                    {showApiKeys[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span>🖥️</span>
                Ollama 基礎 URL
              </CardTitle>
              <CardDescription className="text-xs">本地 Ollama 服務的 API 端點</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={config.ollamaBaseUrl}
                onChange={(e) => updateConfig('ollamaBaseUrl', e.target.value)}
                placeholder="http://localhost:11434/v1"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 分析引數配置 */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>程式碼分析引數</CardTitle>
              <CardDescription>調整程式碼分析的行為和效能</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>最大分析檔案數</Label>
                <Input
                  type="number"
                  value={config.maxAnalyzeFiles}
                  onChange={(e) => updateConfig('maxAnalyzeFiles', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  單次分析任務最多處理的檔案數量
                </p>
              </div>

              <div className="space-y-2">
                <Label>LLM 併發請求數</Label>
                <Input
                  type="number"
                  value={config.llmConcurrency}
                  onChange={(e) => updateConfig('llmConcurrency', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  同時傳送給 LLM 的請求數量（降低可避免速率限制）
                </p>
              </div>

              <div className="space-y-2">
                <Label>請求間隔（毫秒）</Label>
                <Input
                  type="number"
                  value={config.llmGapMs}
                  onChange={(e) => updateConfig('llmGapMs', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  每個 LLM 請求之間的延遲時間
                </p>
              </div>

              <div className="space-y-2">
                <Label>輸出語言</Label>
                <Select
                  value={config.outputLanguage}
                  onValueChange={(value) => updateConfig('outputLanguage', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">🇨🇳 中文</SelectItem>
                    <SelectItem value="en-US">🇺🇸 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 其他配置 */}
        <TabsContent value="other" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>GitHub 整合</CardTitle>
              <CardDescription>配置 GitHub Personal Access Token 以訪問私有倉庫</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>GitHub Token（可選）</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys['github'] ? 'text' : 'password'}
                    value={config.githubToken}
                    onChange={(e) => updateConfig('githubToken', e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey('github')}
                  >
                    {showApiKeys['github'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  獲取：https://github.com/settings/tokens
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GitLab 整合</CardTitle>
              <CardDescription>配置 GitLab Personal Access Token 以訪問私有倉庫</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>GitLab Token（可選）</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys['gitlab'] ? 'text' : 'password'}
                    value={config.gitlabToken}
                    onChange={(e) => updateConfig('gitlabToken', e.target.value)}
                    placeholder="glpat-xxxxxxxxxxxx"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey('gitlab')}
                  >
                    {showApiKeys['gitlab'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  獲取：https://gitlab.com/-/profile/personal_access_tokens
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>配置說明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Database className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">執行時配置</p>
                  <p>
                    配置儲存在瀏覽器 localStorage 中，重新整理頁面後立即生效。
                    可以在不重新構建 Docker 映象的情況下修改配置。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Settings className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">配置優先順序</p>
                  <p>
                    執行時配置 &gt; 構建時配置。如果設定了執行時配置，將覆蓋構建時的環境變數。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Key className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">安全提示</p>
                  <p>
                    API Keys 儲存在瀏覽器本地，其他網站無法訪問。但清除瀏覽器資料會刪除所有配置。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 底部操作按鈕 */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 flex gap-3 bg-background border rounded-lg shadow-lg p-4">
          <Button onClick={saveConfig} size="lg">
            <Save className="w-4 h-4 mr-2" />
            儲存所有更改
          </Button>
          <Button onClick={loadConfig} variant="outline" size="lg">
            取消
          </Button>
        </div>
      )}
    </div>
  );
}

