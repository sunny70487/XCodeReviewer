import { unzip } from "fflate";
import { CodeAnalysisEngine } from "@/features/analysis/services";
import { api } from "@/shared/config/database";
import { taskControl } from "@/shared/services/taskControl";

const TEXT_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".cc", ".hh",
  ".cs", ".php", ".rb", ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml"
  // 注意：已移除 .md，因為文件檔案會導致LLM返回非JSON格式
];

const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200KB
const MAX_ANALYZE_FILES = 50;

// 從環境變數讀取配置，豆包等API需要更長的延遲
const LLM_GAP_MS = Number(import.meta.env.VITE_LLM_GAP_MS) || 2000; // 預設2秒，避免API限流

function isTextFile(path: string): boolean {
  return TEXT_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
}

function shouldExclude(path: string, excludePatterns: string[]): boolean {
  // 排除 Mac 系統檔案
  if (path.includes('__MACOSX/') || path.includes('/.DS_Store') || path.match(/\/\._[^/]+$/)) {
    return true;
  }
  
  // 排除 IDE 和編輯器配置目錄
  const idePatterns = [
    '/.vscode/',
    '/.idea/',
    '/.vs/',
    '/.eclipse/',
    '/.settings/'
  ];
  if (idePatterns.some(pattern => path.includes(pattern))) {
    return true;
  }
  
  // 排除版本控制和依賴目錄
  const systemDirs = [
    '/.git/',
    '/node_modules/',
    '/vendor/',
    '/dist/',
    '/build/',
    '/.next/',
    '/.nuxt/',
    '/target/',
    '/out/',
    '/__pycache__/',
    '/.pytest_cache/',
    '/coverage/',
    '/.nyc_output/'
  ];
  if (systemDirs.some(dir => path.includes(dir))) {
    return true;
  }
  
  // 排除其他隱藏檔案（但保留 .gitignore, .env.example 等重要配置）
  const allowedHiddenFiles = ['.gitignore', '.env.example', '.editorconfig', '.prettierrc'];
  const fileName = path.split('/').pop() || '';
  if (fileName.startsWith('.') && !allowedHiddenFiles.includes(fileName)) {
    return true;
  }
  
  // 排除常見的非程式碼檔案
  const excludeExtensions = [
    '.lock', '.log', '.tmp', '.temp', '.cache',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.pdf', '.zip', '.tar', '.gz', '.rar',
    '.exe', '.dll', '.so', '.dylib',
    '.min.js', '.min.css', '.map'
  ];
  if (excludeExtensions.some(ext => path.toLowerCase().endsWith(ext))) {
    return true;
  }
  
  // 應用使用者自定義的排除模式
  return excludePatterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    }
    return path.includes(pattern);
  });
}

function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'cpp': 'cpp',
    'c': 'cpp',
    'cc': 'cpp',
    'h': 'cpp',
    'hh': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'kt': 'kotlin',
    'swift': 'swift'
  };
  
  return languageMap[extension] || 'text';
}

export async function scanZipFile(params: {
  projectId: string;
  zipFile: File;
  excludePatterns?: string[];
  createdBy?: string;
}): Promise<string> {
  const { projectId, zipFile, excludePatterns = [], createdBy } = params;

  // 建立審計任務，初始化進度欄位
  const task = await api.createAuditTask({
    project_id: projectId,
    task_type: "repository",
    branch_name: "uploaded",
    exclude_patterns: excludePatterns,
    scan_config: { source: "zip_upload" },
    created_by: createdBy,
    total_files: 0,
    scanned_files: 0,
    total_lines: 0,
    issues_count: 0,
    quality_score: 0
  } as any);

  const taskId = (task as any).id;

  console.log(`🚀 ZIP任務已建立: ${taskId}，準備啟動後臺掃描...`);

  // 記錄審計任務開始
  import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
    logger.info(LogCategory.SYSTEM, `開始ZIP檔案審計: ${taskId}`, {
      taskId,
      projectId,
      fileName: zipFile.name,
      fileSize: zipFile.size,
    });
  });

  // 啟動後臺掃描任務，不阻塞返回
  (async () => {
    console.log(`🎬 後臺掃描任務開始執行: ${taskId}`);
    try {
      // 更新任務狀態為執行中
      console.log(`📋 ZIP任務 ${taskId}: 開始更新狀態為 running`);
      await api.updateAuditTask(taskId, { 
        status: "running",
        started_at: new Date().toISOString(),
        total_files: 0,
        scanned_files: 0
      } as any);
      console.log(`✅ ZIP任務 ${taskId}: 狀態已更新為 running`);

      // 讀取ZIP檔案
      const arrayBuffer = await zipFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await new Promise<void>((resolve, reject) => {
        unzip(uint8Array, async (err, unzipped) => {
          if (err) {
            await api.updateAuditTask(taskId, { status: "failed" } as any);
            reject(new Error(`ZIP檔案解壓失敗: ${err.message}`));
            return;
          }

          try {
            // 篩選需要分析的檔案
            const filesToAnalyze: Array<{ path: string; content: string }> = [];
            
            for (const [path, data] of Object.entries(unzipped)) {
              // 跳過目錄
              if (path.endsWith('/')) continue;
              
              // 檢查檔案型別和排除模式
              if (!isTextFile(path) || shouldExclude(path, excludePatterns)) continue;
              
              // 檢查檔案大小
              if (data.length > MAX_FILE_SIZE_BYTES) continue;
              
              try {
                const content = new TextDecoder('utf-8').decode(data);
                filesToAnalyze.push({ path, content });
              } catch (decodeError) {
                // 跳過無法解碼的檔案
                continue;
              }
            }

            // 限制分析檔案數量
            const limitedFiles = filesToAnalyze
              .sort((a, b) => a.path.length - b.path.length) // 優先分析路徑較短的檔案
              .slice(0, MAX_ANALYZE_FILES);

            let totalFiles = limitedFiles.length;
            let scannedFiles = 0;
            let totalLines = 0;
            let totalIssues = 0;
            let qualityScores: number[] = [];
            let failedFiles = 0;

            // 更新總檔案數
            console.log(`📊 ZIP任務 ${taskId}: 設定總檔案數 ${totalFiles}`);
            await api.updateAuditTask(taskId, {
              status: "running",
              total_files: totalFiles,
              scanned_files: 0,
              total_lines: 0,
              issues_count: 0
            } as any);

            // 分析每個檔案
            for (const file of limitedFiles) {
              // ✓ 檢查點1：分析檔案前檢查是否取消
              if (taskControl.isCancelled(taskId)) {
                console.log(`🛑 [檢查點1] 任務 ${taskId} 已被使用者取消（${scannedFiles}/${totalFiles} 完成），停止分析`);
                await api.updateAuditTask(taskId, {
                  status: "cancelled",
                  total_files: totalFiles,
                  scanned_files: scannedFiles,
                  total_lines: totalLines,
                  issues_count: totalIssues,
                  completed_at: new Date().toISOString()
                } as any);
                taskControl.cleanupTask(taskId);
                resolve();
                return;
              }

              try {
                const language = getLanguageFromPath(file.path);
                const lines = file.content.split(/\r?\n/).length;
                totalLines += lines;

                // 使用AI分析程式碼
                const analysis = await CodeAnalysisEngine.analyzeCode(file.content, language);
                
                // ✓ 檢查點2：LLM分析完成後檢查是否取消（最小化浪費）
                if (taskControl.isCancelled(taskId)) {
                  console.log(`🛑 [檢查點2] 任務 ${taskId} 在LLM分析完成後檢測到取消，跳過儲存結果（檔案: ${file.path}）`);
                  await api.updateAuditTask(taskId, {
                    status: "cancelled",
                    total_files: totalFiles,
                    scanned_files: scannedFiles,
                    total_lines: totalLines,
                    issues_count: totalIssues,
                    completed_at: new Date().toISOString()
                  } as any);
                  taskControl.cleanupTask(taskId);
                  resolve();
                  return;
                }
                
                qualityScores.push(analysis.quality_score);

                // 儲存發現的問題
                for (const issue of analysis.issues) {
                  await api.createAuditIssue({
                    task_id: taskId,
                    file_path: file.path,
                    line_number: issue.line || null,
                    column_number: issue.column || null,
                    issue_type: issue.type || "maintainability",
                    severity: issue.severity || "low",
                    title: issue.title || "Issue",
                    description: issue.description || null,
                    suggestion: issue.suggestion || null,
                    code_snippet: issue.code_snippet || null,
                    ai_explanation: issue.ai_explanation || null,
                    status: "open"
                  } as any);
                  
                  totalIssues++;
                }

                scannedFiles++;

                // 每分析一個檔案都更新進度，確保實時性
                console.log(`📈 ZIP任務 ${taskId}: 進度 ${scannedFiles}/${totalFiles} (${Math.round(scannedFiles/totalFiles*100)}%)`);
                await api.updateAuditTask(taskId, {
                  status: "running",
                  total_files: totalFiles,
                  scanned_files: scannedFiles,
                  total_lines: totalLines,
                  issues_count: totalIssues
                } as any);

                // 新增延遲避免API限制（已分析成功，正常延遲）
                await new Promise(resolve => setTimeout(resolve, LLM_GAP_MS));
              } catch (analysisError) {
                failedFiles++;
                scannedFiles++; // 即使失敗也要增加計數
                
                // 增強錯誤日誌記錄
                const errorMsg = (analysisError as Error).message || String(analysisError);
                console.error(`❌ 分析檔案 ${file.path} 失敗 (${failedFiles}/${scannedFiles})`);
                console.error(`   錯誤類型: ${analysisError instanceof Error ? analysisError.constructor.name : typeof analysisError}`);
                console.error(`   錯誤詳情: ${errorMsg}`);
                
                // 檢查是否有保存的調試數據
                const debugKeys = Object.keys(localStorage).filter(k => k.startsWith('llm_response_failed_'));
                if (debugKeys.length > 0) {
                  console.log(`   💾 失敗響應已保存: ${debugKeys[debugKeys.length - 1]}`);
                }
                
                // 記錄錯誤堆棧（如果有）
                if (analysisError instanceof Error && analysisError.stack) {
                  console.error(`   錯誤堆棧: ${analysisError.stack.split('\n').slice(0, 3).join('\n')}`);
                }
                
                // 如果是API頻率限制錯誤，增加較長延遲
                if (errorMsg.includes('頻率超限') || errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
                  // 檢測到限流，逐步增加延遲時間
                  const waitTime = Math.min(60000, 10000 + failedFiles * 5000); // 10秒起步，每次失敗增加5秒，最多60秒
                  console.warn(`⏳ API頻率限制！等待${waitTime/1000}秒後繼續... (已失敗: ${failedFiles}次)`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                  // 其他錯誤，等待較短時間
                  await new Promise(resolve => setTimeout(resolve, LLM_GAP_MS));
                }
                
                // 更新進度（即使失敗也要顯示進度）
                console.log(`📈 ZIP任務 ${taskId}: 進度 ${scannedFiles}/${totalFiles} (${Math.round(scannedFiles/totalFiles*100)}%) - 失敗: ${failedFiles}`);
                await api.updateAuditTask(taskId, {
                  status: "running",
                  total_files: totalFiles,
                  scanned_files: scannedFiles,
                  total_lines: totalLines,
                  issues_count: totalIssues
                } as any);
              }
            }

            // 計算平均質量分
            const avgQualityScore = qualityScores.length > 0 
              ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
              : 0;

            // 判斷任務完成狀態
            const successRate = totalFiles > 0 ? ((scannedFiles - failedFiles) / totalFiles) * 100 : 0;
            const taskStatus = failedFiles >= totalFiles ? "failed" : "completed";
            
            console.log(`📊 掃描完成統計: 總計${totalFiles}個檔案, 成功${scannedFiles - failedFiles}個, 失敗${failedFiles}個, 成功率${successRate.toFixed(1)}%`);
            
            if (failedFiles > 0 && failedFiles < totalFiles) {
              console.warn(`⚠️ 部分檔案分析失敗，但任務標記為完成。建議檢查.env配置或更換LLM提供商`);
            }

            // 更新任務完成狀態
            await api.updateAuditTask(taskId, {
              status: taskStatus,
              total_files: totalFiles,
              scanned_files: scannedFiles,
              total_lines: totalLines,
              issues_count: totalIssues,
              quality_score: avgQualityScore,
              completed_at: new Date().toISOString()
            } as any);

            // 記錄審計完成
            import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
              logger.info(LogCategory.SYSTEM, `ZIP審計任務完成: ${taskId}`, {
                taskId,
                status: taskStatus,
                totalFiles,
                scannedFiles,
                failedFiles,
                totalLines,
                issuesCount: totalIssues,
                qualityScore: avgQualityScore,
                successRate: successRate.toFixed(1) + '%',
              });
            });

            resolve();
          } catch (processingError) {
            await api.updateAuditTask(taskId, { status: "failed" } as any);
            
            // 記錄處理錯誤
            import('@/shared/utils/errorHandler').then(({ handleError }) => {
              handleError(processingError, `ZIP審計任務處理失敗: ${taskId}`);
            });
            
            reject(processingError);
          }
        });
      });
    } catch (error) {
      console.error('❌ ZIP掃描任務執行失敗:', error);
      console.error('錯誤詳情:', error);
      try {
        await api.updateAuditTask(taskId, { status: "failed" } as any);
      } catch (updateError) {
        console.error('更新失敗狀態也失敗了:', updateError);
      }
    }
  })().catch(err => {
    console.error('⚠️ 後臺任務未捕獲的錯誤:', err);
  });

  console.log(`✅ 返回任務ID: ${taskId}，後臺任務正在執行中...`);
  // 立即返回任務ID，讓使用者可以看到進度
  return taskId;
}

export function validateZipFile(file: File): { valid: boolean; error?: string } {
  // 檢查檔案型別
  if (!file.type.includes('zip') && !file.name.toLowerCase().endsWith('.zip')) {
    return { valid: false, error: '請上傳ZIP格式的檔案' };
  }

  // 檢查檔案大小 (限制為100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '檔案大小不能超過100MB' };
  }

  return { valid: true };
}