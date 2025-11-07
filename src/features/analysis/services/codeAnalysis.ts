import type { CodeAnalysisResult } from "@/shared/types";
import { LLMService } from '@/shared/services/llm';
import { getCurrentLLMApiKey, getCurrentLLMModel, env } from '@/shared/config/env';
import type { LLMConfig } from '@/shared/services/llm/types';
import { SUPPORTED_LANGUAGES } from '@/shared/constants';

// 基於 LLM 的程式碼分析引擎
export class CodeAnalysisEngine {
  static getSupportedLanguages(): string[] {
    return [...SUPPORTED_LANGUAGES];
  }

  /**
   * 建立LLM服務例項
   */
  private static createLLMService(): LLMService {
    const apiKey = getCurrentLLMApiKey();
    if (!apiKey) {
      throw new Error(`缺少 ${env.LLM_PROVIDER} API Key，請在 .env 中配置`);
    }

    const config: LLMConfig = {
      provider: env.LLM_PROVIDER as any,
      apiKey,
      model: getCurrentLLMModel(),
      baseUrl: env.LLM_BASE_URL,
      timeout: env.LLM_TIMEOUT,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
    };

    return new LLMService(config);
  }

  static async analyzeCode(code: string, language: string): Promise<CodeAnalysisResult> {
    const llmService = this.createLLMService();

    // 獲取輸出語言配置
    const outputLanguage = env.OUTPUT_LANGUAGE || 'zh-CN';
    const isChineseOutput = outputLanguage === 'zh-CN';

    const schema = `{
      "issues": [
        {
          "type": "security|bug|performance|style|maintainability",
          "severity": "critical|high|medium|low",
          "title": "string",
          "description": "string",
          "suggestion": "string",
          "line": 1,
          "column": 1,
          "code_snippet": "string",
          "ai_explanation": "string",
          "xai": {
            "what": "string",
            "why": "string",
            "how": "string",
            "learn_more": "string(optional)"
          }
        }
      ],
      "quality_score": 0-100,
      "summary": {
        "total_issues": number,
        "critical_issues": number,
        "high_issues": number,
        "medium_issues": number,
        "low_issues": number
      },
      "metrics": {
        "complexity": 0-100,
        "maintainability": 0-100,
        "security": 0-100,
        "performance": 0-100
      }
    }`;

    // 根據配置生成不同語言的提示詞
    const systemPrompt = isChineseOutput
      ? `只輸出JSON，禁止輸出其他任何格式！禁止markdown！禁止文字分析！

你是一個專業的程式碼審計助手。你的任務是分析程式碼並返回嚴格符合JSON Schema的結果。

【最重要】輸出格式要求：
1. 必須只輸出純JSON物件，從{開始，到}結束
2. 禁止在JSON前後新增任何文字、說明、markdown標記
3. 禁止輸出\`\`\`json或###等markdown語法
4. 如果是文件檔案（如README），也必須以JSON格式輸出分析結果

【內容要求】：
1. 所有文字內容必須統一使用繁體中文（台灣）
2. JSON字串值中的特殊字元必須正確轉義（換行用\\n，雙引號用\\"，反斜槓用\\\\）
3. code_snippet欄位必須使用\\n表示換行

請從以下維度全面分析程式碼：
- 編碼規範和程式碼風格
- 潛在的 Bug 和邏輯錯誤
- 效能問題和最佳化建議
- 安全漏洞和風險
- 可維護性和可讀性
- 最佳實踐和設計模式

輸出格式必須嚴格符合以下 JSON Schema：

${schema}

注意：
- title: 問題的簡短標題（中文）
- description: 詳細描述問題（中文）
- suggestion: 具體的修復建議（中文）
- line: 問題所在的行號（從1開始計數，必須準確對應程式碼中的行號）
- column: 問題所在的列號（從1開始計數，指向問題程式碼的起始位置）
- code_snippet: 包含問題的程式碼片段（建議包含問題行及其前後1-2行作為上下文，保持原始縮排格式）
- ai_explanation: AI 的深入解釋（中文）
- xai.what: 這是什麼問題（中文）
- xai.why: 為什麼會有這個問題（中文）
- xai.how: 如何修復這個問題（中文）

【重要】關於行號和程式碼片段：
1. line 必須是問題程式碼的行號！！！程式碼左側有"行號|"標註，例如"25| const x = 1"表示第25行，line欄位必須填25
2. column 是問題程式碼在該行中的起始列位置（從1開始，不包括"行號|"字首部分）
3. code_snippet 應該包含問題程式碼及其上下文（前後各1-2行），去掉"行號|"字首，保持原始程式碼的縮排
4. 如果程式碼片段包含多行，必須使用 \\n 表示換行符（這是JSON的要求）
5. 如果無法確定準確的行號，不要填寫line和column欄位（不要填0）

【嚴格禁止】：
- 禁止在任何欄位中使用英文，所有內容必須是繁體中文（台灣）
- 禁止在JSON字串值中使用真實換行符，必須用\\n轉義
- 禁止輸出markdown程式碼塊標記（如\`\`\`json）

示例（假設程式碼中第25行是 "25| config[password] = user_password"）：
{
  "issues": [{
    "type": "security",
    "severity": "high",
    "title": "密碼明文儲存",
    "description": "密碼以明文形式儲存在配置檔案中",
    "suggestion": "使用加密演算法對密碼進行加密儲存",
    "line": 25,
    "column": 5,
    "code_snippet": "config[password] = user_password\\nconfig.save()",
    "ai_explanation": "明文儲存密碼存在安全風險",
    "xai": {
      "what": "密碼未加密直接儲存",
      "why": "容易被未授權訪問獲取",
      "how": "使用AES等加密演算法加密後再儲存"
    }
  }],
  "quality_score": 75,
  "summary": {"total_issues": 1, "critical_issues": 0, "high_issues": 1, "medium_issues": 0, "low_issues": 0},
  "metrics": {"complexity": 80, "maintainability": 75, "security": 70, "performance": 85}
}

重要提醒：line欄位必須從程式碼左側的行號標註中讀取，不要猜測或填0！`
      : `OUTPUT JSON ONLY! NO OTHER FORMAT! NO MARKDOWN! NO TEXT ANALYSIS!

You are a professional code auditing assistant. Your task is to analyze code and return results in strict JSON Schema format.

【MOST IMPORTANT】Output format requirements:
1. MUST output pure JSON object only, starting with { and ending with }
2. NO text, explanation, or markdown markers before or after JSON
3. NO \`\`\`json or ### markdown syntax
4. Even for document files (like README), output analysis in JSON format

【Content requirements】:
1. All text content MUST be in English ONLY
2. Special characters in JSON strings must be properly escaped (\\n for newlines, \\" for quotes, \\\\ for backslashes)
3. code_snippet field MUST use \\n for newlines

Please comprehensively analyze the code from the following dimensions:
- Coding standards and code style
- Potential bugs and logical errors
- Performance issues and optimization suggestions
- Security vulnerabilities and risks
- Maintainability and readability
- Best practices and design patterns

The output format MUST strictly conform to the following JSON Schema:

${schema}

Note:
- title: Brief title of the issue (in English)
- description: Detailed description of the issue (in English)
- suggestion: Specific fix suggestions (in English)
- line: Line number where the issue occurs (1-indexed, must accurately correspond to the line in the code)
- column: Column number where the issue starts (1-indexed, pointing to the start position of the problematic code)
- code_snippet: Code snippet containing the issue (should include the problem line plus 1-2 lines before and after for context, preserve original indentation)
- ai_explanation: AI's in-depth explanation (in English)
- xai.what: What is this issue (in English)
- xai.why: Why does this issue exist (in English)
- xai.how: How to fix this issue (in English)

【IMPORTANT】About line numbers and code snippets:
1. 'line' MUST be the line number from code!!! Code has "lineNumber|" prefix, e.g. "25| const x = 1" means line 25, you MUST set line to 25
2. 'column' is the starting column position in that line (1-indexed, excluding the "lineNumber|" prefix)
3. 'code_snippet' should include the problematic code with context (1-2 lines before/after), remove "lineNumber|" prefix, preserve indentation
4. If code snippet has multiple lines, use \\n for newlines (JSON requirement)
5. If you cannot determine the exact line number, do NOT fill line and column fields (don't use 0)

【STRICTLY PROHIBITED】:
- NO Chinese characters in any field - English ONLY
- NO real newline characters in JSON string values - must use \\n
- NO markdown code block markers (like \`\`\`json)

Example (assuming line 25 in code is "25| config[password] = user_password"):
{
  "issues": [{
    "type": "security",
    "severity": "high",
    "title": "Plain text password storage",
    "description": "Password is stored in plain text in config file",
    "suggestion": "Use encryption algorithm to encrypt password before storage",
    "line": 25,
    "column": 5,
    "code_snippet": "config[password] = user_password\\nconfig.save()",
    "ai_explanation": "Storing passwords in plain text poses security risks",
    "xai": {
      "what": "Password stored without encryption",
      "why": "Easy to access by unauthorized users",
      "how": "Use AES or similar encryption before storing"
    }
  }],
  "quality_score": 75,
  "summary": {"total_issues": 1, "critical_issues": 0, "high_issues": 1, "medium_issues": 0, "low_issues": 0},
  "metrics": {"complexity": 80, "maintainability": 75, "security": 70, "performance": 85}
}

CRITICAL: Read line numbers from the "lineNumber|" prefix on the left of each code line. Do NOT guess or use 0!`;

    // 為程式碼新增行號，幫助LLM準確定位問題
    const codeWithLineNumbers = code.split('\n').map((line, idx) => `${idx + 1}| ${line}`).join('\n');
    
    const userPrompt = isChineseOutput
      ? `程式語言: ${language}

程式碼已標註行號（格式：行號| 程式碼內容），請根據行號準確填寫 line 欄位！

請分析以下程式碼:

${codeWithLineNumbers}`
      : `Programming Language: ${language}

Code is annotated with line numbers (format: lineNumber| code), please fill the 'line' field accurately based on these numbers!

Please analyze the following code:

${codeWithLineNumbers}`;

    let text = '';
    try {
      console.log('🚀 開始呼叫 LLM 分析...');
      console.log(`📡 提供商: ${env.LLM_PROVIDER}`);
      console.log(`🤖 模型: ${getCurrentLLMModel()}`);
      console.log(`🔗 Base URL: ${env.LLM_BASE_URL || '(預設)'}`);

      // 使用新的LLM服務進行分析
      const response = await llmService.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      });
      text = response.content;

      console.log('✅ LLM 響應成功');
      console.log(`📊 響應長度: ${text.length} 字元`);
      console.log(`📝 響應內容預覽: ${text.substring(0, 200)}...`);
      
      // 檢測響應是否可能被截斷
      const seemsTruncated = this.detectTruncation(text);
      if (seemsTruncated) {
        console.warn('⚠️ 警告：響應似乎被截斷了！');
        console.warn(`   當前 maxTokens: ${env.LLM_MAX_TOKENS}`);
        if (env.LLM_MAX_TOKENS > 0) {
          console.warn('   建議1：增加 VITE_LLM_MAX_TOKENS 配置（如 16384）');
          console.warn('   建議2：設置 VITE_LLM_MAX_TOKENS=0 表示不限制（讓模型自行決定）');
        } else {
          console.warn('   已設置為不限制，但仍被截斷。可能是模型本身的限制。');
          console.warn('   建議：切換到支持更長輸出的模型（如 gemini-1.5-pro）');
        }
      }
    } catch (e: any) {
      console.error('LLM分析失敗:', e);

      // 構造更友好的錯誤訊息
      const errorMsg = e.message || '未知錯誤';
      const provider = env.LLM_PROVIDER;

      // 丟擲詳細的錯誤資訊給前端
      throw new Error(
        `${provider} API呼叫失敗\n\n` +
        `錯誤詳情：${errorMsg}\n\n` +
        `配置檢查：\n` +
        `- 提供商：${provider}\n` +
        `- 模型：${getCurrentLLMModel() || '(使用預設)'}\n` +
        `- API Key：${getCurrentLLMApiKey() ? '已配置' : '未配置'}\n` +
        `- 超時設定：${env.LLM_TIMEOUT}ms\n\n` +
        `請檢查.env配置檔案或嘗試切換其他LLM提供商`
      );
    }
    const parsed = this.safeParseJson(text);

    // 如果解析失敗，丟擲錯誤而不是返回預設值
    if (!parsed) {
      const provider = env.LLM_PROVIDER;
      const currentModel = getCurrentLLMModel();

      // 保存失敗的原始響應供調試
      try {
        this.cleanupDebugData(); // 清理舊數據
        const debugKey = `llm_response_failed_${Date.now()}`;
        const debugData = {
          timestamp: new Date().toISOString(),
          provider: provider,
          model: currentModel,
          responseLength: text.length,
          responsePreview: text.substring(0, 1000),
          responseFull: text.length < 50000 ? text : text.substring(0, 50000) + '...(truncated)'
        };
        localStorage.setItem(debugKey, JSON.stringify(debugData));
        console.error('❌ 完整響應已保存到 localStorage:', debugKey);
        console.error('💡 可以使用以下命令查看: localStorage.getItem("' + debugKey + '")');
      } catch (storageError) {
        console.warn('⚠️ 無法保存調試數據到 localStorage:', storageError);
      }

      // 檢測響應是否被截斷
      const seemsTruncated = this.detectTruncation(text);
      
      let suggestions = '';
      if (seemsTruncated) {
        // 響應被截斷的特殊提示
        suggestions =
          `⚠️ 檢測到響應被截斷！\n\n` +
          `立即修復步驟：\n` +
          `1. 完全移除限制（最簡單）：\n` +
          `   在 .env 中添加/修改：VITE_LLM_MAX_TOKENS=0\n` +
          `   這會讓模型輸出盡可能多的內容\n\n` +
          `2. 或設置更大的值：\n` +
          `   VITE_LLM_MAX_TOKENS=16384（推薦給 Gemini）\n` +
          `   VITE_LLM_MAX_TOKENS=32768（如果模型支持）\n\n` +
          `3. 如果問題持續，嘗試更換模型：\n` +
          `   ${provider === 'gemini' ? '- gemini-1.5-pro（支持更長輸出）\n   - gemini-2.0-flash-exp（最新實驗版）' : '- 使用該提供商支持更長輸出的模型'}\n\n` +
          `4. 重啟應用使配置生效\n\n` +
          `當前配置：\n` +
          `- maxTokens: ${env.LLM_MAX_TOKENS}${env.LLM_MAX_TOKENS <= 0 ? ' (不限制)' : ''}\n` +
          `- 實際響應長度: ${text.length} 字符`;
      } else if (provider === 'ollama') {
        suggestions =
          `建議解決方案：\n` +
          `1. 升級到更強的模型（推薦）：\n` +
          `   ollama pull codellama\n` +
          `   ollama pull qwen2.5:7b\n` +
          `2. 更新配置檔案 .env：\n` +
          `   VITE_LLM_MODEL=codellama\n` +
          `3. 增加 maxTokens：VITE_LLM_MAX_TOKENS=8192\n` +
          `4. 重啟應用後重試\n\n` +
          `注意：超輕量模型僅適合測試連線，實際使用需要更強的模型。`;
      } else {
        suggestions =
          `建議解決方案：\n` +
          `1. 移除輸出限制（推薦）：\n` +
          `   在 .env 中設置：VITE_LLM_MAX_TOKENS=0\n` +
          `   或設置更大的值：VITE_LLM_MAX_TOKENS=16384\n` +
          `2. 嘗試更換更強大的模型（在 .env 中修改 VITE_LLM_MODEL）\n` +
          `3. 檢查當前模型是否支援結構化輸出（JSON 格式）\n` +
          `4. 嘗試切換到其他 LLM 提供商：\n` +
          `   - Gemini (免費額度充足，支持長輸出)\n` +
          `   - OpenAI GPT (穩定可靠)\n` +
          `   - Claude (程式碼理解能力強，最高支持 8192 輸出)\n` +
          `   - DeepSeek (價效比高)\n` +
          `5. 如果使用代理，檢查網路連線是否穩定\n` +
          `6. 增加超時時間（VITE_LLM_TIMEOUT）`;
      }

      throw new Error(
        `LLM 響應解析失敗\n\n` +
        `提供商: ${provider}\n` +
        `模型: ${currentModel || '(預設)'}\n` +
        `響應長度: ${text.length} 字符\n\n` +
        `響應預覽（前500字符）:\n${text.substring(0, Math.min(500, text.length))}\n\n` +
        `原因：當前模型返回的內容不是有效的 JSON 格式，\n` +
        `這可能是因為模型能力不足或配置不當。\n\n` +
        suggestions
      );
    }

    console.log('🔍 解析結果:', {
      hasIssues: Array.isArray(parsed?.issues),
      issuesCount: parsed?.issues?.length || 0,
      hasMetrics: !!parsed?.metrics,
      hasQualityScore: !!parsed?.quality_score
    });

    const issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
    
    // 規範化issues，確保資料格式正確
    issues.forEach((issue: any, index: number) => {
      // 驗證行號和列號的合理性
      if (issue.line !== undefined) {
        const originalLine = issue.line;
        const parsedLine = parseInt(issue.line);
        // 如果行號是0或無效值，設定為undefined而不是1（表示未知位置）
        if (isNaN(parsedLine) || parsedLine <= 0) {
          console.warn(`⚠️ 問題 #${index + 1} "${issue.title}" 的行號無效: ${originalLine}，已設定為 undefined`);
          issue.line = undefined;
        } else {
          issue.line = parsedLine;
        }
      }
      
      if (issue.column !== undefined) {
        const originalColumn = issue.column;
        const parsedColumn = parseInt(issue.column);
        // 如果列號是0或無效值，設定為undefined而不是1
        if (isNaN(parsedColumn) || parsedColumn <= 0) {
          console.warn(`⚠️ 問題 #${index + 1} "${issue.title}" 的列號無效: ${originalColumn}，已設定為 undefined`);
          issue.column = undefined;
        } else {
          issue.column = parsedColumn;
        }
      }
      
      // 確保所有文字欄位都存在且是字串型別
      const textFields = ['title', 'description', 'suggestion', 'ai_explanation'];
      textFields.forEach(field => {
        if (issue[field] && typeof issue[field] !== 'string') {
          issue[field] = String(issue[field]);
        }
      });
      
      // code_snippet已經由JSON.parse正確處理，不需要額外處理
      // JSON.parse會自動將\\n轉換為真實的換行符，這正是我們想要的
    });
    
    const metrics = parsed?.metrics ?? this.estimateMetricsFromIssues(issues);
    const qualityScore = parsed?.quality_score ?? this.calculateQualityScore(metrics, issues);

    console.log(`📋 最終發現 ${issues.length} 個問題`);
    console.log(`⭐ 質量評分: ${qualityScore}`);

    return {
      issues,
      quality_score: qualityScore,
      summary: parsed?.summary ?? {
        total_issues: issues.length,
        critical_issues: issues.filter((i: any) => i.severity === 'critical').length,
        high_issues: issues.filter((i: any) => i.severity === 'high').length,
        medium_issues: issues.filter((i: any) => i.severity === 'medium').length,
        low_issues: issues.filter((i: any) => i.severity === 'low').length,
      },
      metrics
    } as CodeAnalysisResult;
  }

  private static safeParseJson(text: string): any {
    // 預處理：修復常見的非標準 JSON 格式
    const fixJsonFormat = (str: string): string => {
      // 1. 去除前後空白
      str = str.trim();

      // 2. 修復尾部逗號（JSON 不允許）- 必須在其他處理之前
      str = str.replace(/,(\s*[}\]])/g, '$1');

      // 3. 修復缺少逗號的問題
      str = str.replace(/\}(\s*)\{/g, '},\n{');
      str = str.replace(/\](\s*)\[/g, '],\n[');
      str = str.replace(/\}(\s*)"([^"]+)":/g, '},\n"$2":');
      str = str.replace(/\](\s*)"([^"]+)":/g, '],\n"$2":');

      // 4. 修復物件/陣列後缺少逗號的情況
      str = str.replace(/([}\]])(\s*)(")/g, '$1,\n$3');

      // 5. 移除多餘的逗號
      str = str.replace(/,+/g, ',');

      return str;
    };

    // 清理和修復 JSON 字串
    const cleanText = (str: string): string => {
      // 移除 BOM 和零寬字元
      let cleaned = str
        .replace(/^\uFEFF/, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');

      // 使用狀態機智慧處理JSON字串值中的控制字元
      // 這種方法可以正確處理包含換行符、引號等特殊字元的多行字串
      let result = '';
      let inString = false;
      let isKey = false;  // 是否在處理鍵名
      let prevChar = '';
      
      for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const nextChar = cleaned[i + 1] || '';
        
        // 檢測字串的開始和結束（檢查前一個字元不是未轉義的反斜槓）
        if (char === '"' && prevChar !== '\\') {
          if (!inString) {
            // 字串開始 - 判斷是鍵還是值
            // 簡單判斷：如果前面有冒號，則是值，否則是鍵
            const beforeQuote = result.slice(Math.max(0, result.length - 10));
            isKey = !beforeQuote.includes(':') || beforeQuote.lastIndexOf(':') < beforeQuote.lastIndexOf('{') || beforeQuote.lastIndexOf(':') < beforeQuote.lastIndexOf(',');
          }
          inString = !inString;
          result += char;
          prevChar = char;
          continue;
        }
        
        // 在字串值內部（非鍵名）處理特殊字元
        if (inString && !isKey) {
          const code = char.charCodeAt(0);
          
          // 轉義控制字元
          if (code === 0x0A) {  // 換行符
            result += '\\n';
            prevChar = 'n';  // 防止被識別為轉義符
            continue;
          } else if (code === 0x0D) {  // 回車符
            result += '\\r';
            prevChar = 'r';
            continue;
          } else if (code === 0x09) {  // 製表符
            result += '\\t';
            prevChar = 't';
            continue;
          } else if (code < 0x20 || (code >= 0x7F && code <= 0x9F)) {
            // 其他控制字元：移除
            prevChar = char;
            continue;
          }
          
          // 處理反斜槓
          if (char === '\\' && nextChar && '"\\/bfnrtu'.indexOf(nextChar) === -1) {
            // 無效的轉義序列，轉義反斜槓本身
            result += '\\\\';
            prevChar = '\\';
            continue;
          }
          
          // 移除中文引號（使用Unicode編碼避免語法錯誤）
          const charCode = char.charCodeAt(0);
          if (charCode === 0x201C || charCode === 0x201D || charCode === 0x2018 || charCode === 0x2019) {
            prevChar = char;
            continue;
          }
        }
        
        // 預設情況：保持字元不變
        result += char;
        prevChar = char;
      }

      return result;
    };

    // 嘗試多種方式解析
    const attempts = [
      // 1. 直接解析原始響應（如果LLM輸出格式完美）
      () => {
        return JSON.parse(text);
      },
      // 2. 清理後再解析
      () => {
        const cleaned = cleanText(text);
        const fixed = fixJsonFormat(cleaned);
        return JSON.parse(fixed);
      },
      // 3. 提取 JSON 物件（智慧匹配，處理字串中的花括號）
      () => {
        const cleaned = cleanText(text);
        // 找到第一個 { 的位置
        const startIdx = cleaned.indexOf('{');
        if (startIdx === -1) throw new Error('No JSON object found');

        // 從第一個 { 開始，找到匹配的 }，需要考慮字串中的引號
        let braceCount = 0;
        let endIdx = -1;
        let inString = false;
        let prevChar = '';
        
        for (let i = startIdx; i < cleaned.length; i++) {
          const char = cleaned[i];
          
          // 檢測字串邊界（排除轉義的引號）
          if (char === '"' && prevChar !== '\\') {
            inString = !inString;
          }
          
          // 只在字串外部統計花括號
          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIdx = i + 1;
                break;
              }
            }
          }
          
          prevChar = char;
        }

        if (endIdx === -1) throw new Error('Incomplete JSON object');

        const jsonStr = cleaned.substring(startIdx, endIdx);
        const fixed = fixJsonFormat(jsonStr);
        return JSON.parse(fixed);
      },
      // 4. 去除 markdown 程式碼塊
      () => {
        const cleaned = cleanText(text);
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (codeBlockMatch) {
          const fixed = fixJsonFormat(codeBlockMatch[1]);
          return JSON.parse(fixed);
        }
        throw new Error('No code block found');
      },
      // 5. 嘗試修復截斷的 JSON
      () => {
        const cleaned = cleanText(text);
        const startIdx = cleaned.indexOf('{');
        if (startIdx === -1) throw new Error('Cannot fix truncated JSON');

        let json = cleaned.substring(startIdx);
        // 嘗試補全未閉合的結構
        const openBraces = (json.match(/\{/g) || []).length;
        const closeBraces = (json.match(/\}/g) || []).length;
        const openBrackets = (json.match(/\[/g) || []).length;
        const closeBrackets = (json.match(/\]/g) || []).length;

        // 補全缺失的閉合符號
        json += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
        json += '}'.repeat(Math.max(0, openBraces - closeBraces));

        const fixed = fixJsonFormat(json);
        return JSON.parse(fixed);
      }
    ];

    let lastError: any = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        const result = attempts[i]();
        if (i > 0) {
          console.log(`✅ JSON解析成功（方法 ${i + 1}/${attempts.length}）`);
        }
        return result;
      } catch (e) {
        lastError = e;
        if (i === 0) {
          console.warn('直接解析失敗，嘗試清理後解析...', e);
        } else if (i === 2) {
          console.warn('提取 JSON 物件後解析失敗:', e);
        } else if (i === 3) {
          console.warn('從程式碼塊提取 JSON 失敗:', e);
        }
      }
    }

    // 所有嘗試都失敗
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;
    const seemsTruncated = this.detectTruncation(text);
    
    console.error('⚠️ 無法解析 LLM 響應為 JSON');
    console.error('📊 響應統計:', {
      length: text.length,
      hasOpenBrace: text.includes('{'),
      hasCloseBrace: text.includes('}'),
      firstChar: text.charAt(0),
      lastChar: text.charAt(text.length - 1),
      openBraceCount: openBraces,
      closeBraceCount: closeBraces,
      bracesMismatch: openBraces - closeBraces,
      seemsTruncated: seemsTruncated
    });
    
    if (seemsTruncated) {
      console.error('🚨 響應被截斷！');
      console.error(`   未閉合的大括號數量: ${openBraces - closeBraces}`);
      console.error(`   當前 maxTokens 配置: ${env.LLM_MAX_TOKENS}${env.LLM_MAX_TOKENS <= 0 ? ' (已設為不限制)' : ''}`);
      if (env.LLM_MAX_TOKENS > 0) {
        console.error('   解決方法1: 設置 VITE_LLM_MAX_TOKENS=0（不限制）');
        console.error('   解決方法2: 增加 VITE_LLM_MAX_TOKENS 到 16384 或更高');
      } else {
        console.error('   已設為不限制但仍被截斷，可能是模型本身的限制');
        console.error('   建議：切換到支持更長輸出的模型');
      }
    }
    
    console.error('📄 原始內容（前1000字元）:');
    console.error(text.substring(0, Math.min(1000, text.length)));
    console.error('📄 原始內容（後500字元）:');
    console.error(text.substring(Math.max(0, text.length - 500)));
    console.error('❌ 最後的解析錯誤:', lastError);
    
    if (seemsTruncated) {
      console.warn('💡 提示: 響應被截斷，請增加 maxTokens 配置');
    } else {
      console.warn('💡 提示: 當前模型可能無法生成有效的 JSON 格式');
      console.warn('   建議：更換更強大的模型或切換其他 LLM 提供商');
    }
    return null;
  }

  private static estimateMetricsFromIssues(issues: any[]) {
    const base = 90;
    const penalty = Math.min(60, (issues?.length || 0) * 2);
    const score = Math.max(0, base - penalty);
    return {
      complexity: score,
      maintainability: score,
      security: score,
      performance: score
    };
  }

  private static calculateQualityScore(metrics: any, issues: any[]): number {
    const criticalWeight = 30;
    const highWeight = 20;
    const mediumWeight = 10;
    const lowWeight = 5;

    const criticalIssues = issues.filter((i: any) => i.severity === 'critical').length;
    const highIssues = issues.filter((i: any) => i.severity === 'high').length;
    const mediumIssues = issues.filter((i: any) => i.severity === 'medium').length;
    const lowIssues = issues.filter((i: any) => i.severity === 'low').length;

    const issueScore = 100 - (
      criticalIssues * criticalWeight +
      highIssues * highWeight +
      mediumIssues * mediumWeight +
      lowIssues * lowWeight
    );

    const metricsScore = (
      metrics.complexity +
      metrics.maintainability +
      metrics.security +
      metrics.performance
    ) / 4;

    return Math.max(0, Math.min(100, (issueScore + metricsScore) / 2));
  }

  /**
   * 檢測響應是否可能被截斷
   */
  private static detectTruncation(text: string): boolean {
    const trimmed = text.trim();
    
    // 檢查1：以 ```json 開頭但沒有對應的結束標記
    if (trimmed.startsWith('```json') && !trimmed.endsWith('```')) {
      return true;
    }
    
    // 檢查2：包含 { 但沒有對應的 }
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      return true;
    }
    
    // 檢查3：響應太短（少於 1000 字符）且以不完整的 JSON 結構結束
    if (trimmed.length < 1000) {
      const lastChars = trimmed.slice(-50);
      // 如果最後包含未閉合的引號或逗號後沒有下一個元素
      if (lastChars.includes('"type":') || lastChars.includes('"title":') || 
          lastChars.match(/:[\s]*"[^"]*$/)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 清理舊的調試數據（保留最近10條）
   */
  private static cleanupDebugData(): void {
    try {
      const debugKeys = Object.keys(localStorage)
        .filter(k => k.startsWith('llm_response_failed_'))
        .sort()
        .reverse();
      
      // 保留最近10條，刪除更舊的
      if (debugKeys.length > 10) {
        debugKeys.slice(10).forEach(key => {
          localStorage.removeItem(key);
          console.log('🧹 已清理舊的調試數據:', key);
        });
      }
    } catch (e) {
      console.warn('⚠️ 清理調試數據失敗:', e);
    }
  }

  // 倉庫級別的分析（佔位保留）
  static async analyzeRepository(_repoUrl: string, _branch: string = 'main', _excludePatterns: string[] = []): Promise<{
    taskId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { taskId, status: 'pending' };
  }

  // GitHub/GitLab整合（佔位保留）
  static async getRepositories(_token: string, _platform: 'github' | 'gitlab'): Promise<any[]> {
    return [
      {
        id: '1',
        name: 'example-project',
        full_name: 'user/example-project',
        description: '示例專案',
        html_url: 'https://github.com/user/example-project',
        clone_url: 'https://github.com/user/example-project.git',
        default_branch: 'main',
        language: 'JavaScript',
        private: false,
        updated_at: new Date().toISOString()
      }
    ];
  }

  static async getBranches(_repoUrl: string, _token: string): Promise<any[]> {
    return [
      {
        name: 'main',
        commit: {
          sha: 'abc123',
          url: 'https://github.com/user/repo/commit/abc123'
        },
        protected: true
      },
      {
        name: 'develop',
        commit: {
          sha: 'def456',
          url: 'https://github.com/user/repo/commit/def456'
        },
        protected: false
      }
    ];
  }
}