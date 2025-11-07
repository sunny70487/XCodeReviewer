import { api } from "@/shared/config/database";
import { CodeAnalysisEngine } from "@/features/analysis/services";
import { taskControl } from "@/shared/services/taskControl";

type GithubTreeItem = { path: string; type: "blob" | "tree"; size?: number; url: string; sha: string };

const TEXT_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".cc", ".hh", ".cs", ".php", ".rb", ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml"
  // 注意：已移除 .md，因為文件檔案會導致LLM返回非JSON格式
];
const MAX_FILE_SIZE_BYTES = 200 * 1024;
const MAX_ANALYZE_FILES = Number(import.meta.env.VITE_MAX_ANALYZE_FILES || 40);
const LLM_CONCURRENCY = Number(import.meta.env.VITE_LLM_CONCURRENCY || 2);
const LLM_GAP_MS = Number(import.meta.env.VITE_LLM_GAP_MS || 500);

const isTextFile = (p: string) => TEXT_EXTENSIONS.some(ext => p.toLowerCase().endsWith(ext));
const matchExclude = (p: string, ex: string[]) => ex.some(e => p.includes(e.replace(/^\//, "")) || (e.endsWith("/**") && p.startsWith(e.slice(0, -3).replace(/^\//, ""))));

async function githubApi<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Accept": "application/vnd.github+json" };
  const t = token || (import.meta.env.VITE_GITHUB_TOKEN as string | undefined);
  if (t) headers["Authorization"] = `Bearer ${t}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 403) throw new Error("GitHub API 403：請配置 VITE_GITHUB_TOKEN 或確認倉庫許可權/頻率限制");
    throw new Error(`GitHub API ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

async function gitlabApi<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = token || (import.meta.env.VITE_GITLAB_TOKEN as string | undefined);
  if (t) {
    // 支援兩種 token 格式：
    // 1. 標準 Personal Access Token (glpat-xxx)
    // 2. OAuth2 token (從 URL 中提取的純 token)
    headers["PRIVATE-TOKEN"] = t;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 401) throw new Error("GitLab API 401：請配置 VITE_GITLAB_TOKEN 或確認倉庫許可權");
    if (res.status === 403) throw new Error("GitLab API 403：請確認倉庫許可權/頻率限制");
    throw new Error(`GitLab API ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function runRepositoryAudit(params: {
  projectId: string;
  repoUrl: string;
  branch?: string;
  exclude?: string[];
  githubToken?: string;
  gitlabToken?: string;
  createdBy?: string;
}) {
  const branch = params.branch || "main";
  const excludes = params.exclude || [];
  const task = await api.createAuditTask({
    project_id: params.projectId,
    task_type: "repository",
    branch_name: branch,
    exclude_patterns: excludes,
    scan_config: {},
    created_by: params.createdBy,
    total_files: 0,
    scanned_files: 0,
    total_lines: 0,
    issues_count: 0,
    quality_score: 0
  } as any);

  const taskId = (task as any).id as string;
  // 基於專案的 repository_type 決定倉庫型別，不再使用正則
  const project = await api.getProjectById(params.projectId);
  const repoUrl = params.repoUrl || project?.repository_url || '';
  if (!repoUrl) throw new Error('倉庫地址為空，請在專案中填寫 repository_url');
  const repoTypeKey = project?.repository_type;
  const isGitHub = repoTypeKey === 'github';
  const isGitLab = repoTypeKey === 'gitlab';
  const repoType = isGitHub ? "GitHub" : isGitLab ? "GitLab" : "Git";

  console.log(`🚀 ${repoType}任務已建立: ${taskId}，準備啟動後臺掃描...`);

  // 記錄審計任務開始
  import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
    logger.info(LogCategory.SYSTEM, `開始審計任務: ${taskId}`, {
      taskId,
      projectId: params.projectId,
      repoUrl,
      branch,
      repoType,
    });
  });

  // 啟動後臺審計任務，不阻塞返回
  (async () => {
    console.log(`🎬 後臺掃描任務開始執行: ${taskId}`);
    try {
      console.log(`📡 任務 ${taskId}: 正在獲取倉庫檔案列表...`);
      
      let files: { path: string; url?: string }[] = [];

      if (isGitHub) {
        // GitHub 倉庫處理
        const m = repoUrl.match(/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i);
        if (!m) throw new Error("GitHub 倉庫 URL 格式錯誤，例如 https://github.com/owner/repo");
        const owner = m[1];
        const repo = m[2];

        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
        const tree = await githubApi<{ tree: GithubTreeItem[] }>(treeUrl, params.githubToken);
        files = (tree.tree || [])
          .filter(i => i.type === "blob" && isTextFile(i.path) && !matchExclude(i.path, excludes))
          .map(i => ({ path: i.path, url: `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${i.path}` }));
      } else if (isGitLab) {
        // GitLab 倉庫處理（支援自定義域名/IP）：基於倉庫 URL 動態構建 API 基地址
        const u = new URL(repoUrl);
        
        // 從 URL 中提取 OAuth2 token（如果存在）
        // 格式：https://oauth2:TOKEN@host/path 或 https://TOKEN@host/path
        let extractedToken = params.gitlabToken;
        if (u.username) {
          // 如果 username 是 oauth2，token 在 password 中
          if (u.username === 'oauth2' && u.password) {
            extractedToken = u.password;
          } 
          // 如果直接使用 token 作為 username
          else if (u.username && !u.password) {
            extractedToken = u.username;
          }
        }
        
        const base = `${u.protocol}//${u.host}`; // 例如 https://git.dev-rs.com 或 http://192.168.1.10
        // 解析專案路徑，支援多級 group/subgroup，去除開頭/結尾斜槓與 .git 字尾
        const path = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
        if (!path) {
          throw new Error("GitLab 倉庫 URL 格式錯誤，例如 https://<your-gitlab-host>/<group>/<project>");
        }
        const projectPath = encodeURIComponent(path);

        const treeUrl = `${base}/api/v4/projects/${projectPath}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100`;
        console.log(`📡 GitLab API: 獲取倉庫檔案樹 - ${treeUrl}`);
        const tree = await gitlabApi<Array<{ path: string; type: string }>>(treeUrl, extractedToken);
        console.log(`✅ GitLab API: 獲取到 ${tree.length} 個專案`);

        files = tree
          .filter(i => i.type === "blob" && isTextFile(i.path) && !matchExclude(i.path, excludes))
          .map(i => ({ 
            path: i.path, 
            // GitLab 檔案 API 路徑需要完整的 URL 編碼（包括斜槓）
            url: `${base}/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(i.path)}/raw?ref=${encodeURIComponent(branch)}` 
          }));

        console.log(`📝 GitLab: 過濾後可分析檔案 ${files.length} 個`);
        if (tree.length >= 100) {
          console.warn(`⚠️ GitLab: 檔案數量達到API限制(100)，可能有檔案未被掃描。建議使用排除模式減少檔案數。`);
        }
      } else {
        throw new Error("不支援的倉庫型別，僅支援 GitHub 和 GitLab 倉庫");
      }

      // 取樣限制，優先分析較小檔案與常見語言
      files = files
        .sort((a, b) => (a.path.length - b.path.length))
        .slice(0, MAX_ANALYZE_FILES);

      // 立即更新狀態為 running 並設定總檔案數，讓使用者看到進度
      console.log(`📊 任務 ${taskId}: 獲取到 ${files.length} 個檔案，開始分析`);
      await api.updateAuditTask(taskId, {
        status: "running",
        started_at: new Date().toISOString(),
        total_files: files.length,
        scanned_files: 0
      } as any);
      console.log(`✅ 任務 ${taskId}: 狀態已更新為 running，total_files=${files.length}`);

      let totalFiles = 0, totalLines = 0, createdIssues = 0;
      let index = 0;
      let failedCount = 0;  // 失敗計數器
      let consecutiveFailures = 0;  // 連續失敗計數
      const MAX_CONSECUTIVE_FAILURES = 5;  // 最大連續失敗次數
      const MAX_TOTAL_FAILURES_RATIO = 0.5;  // 最大失敗率（50%）
      
      const worker = async () => {
        while (true) {
          const current = index++;
          if (current >= files.length) break;
          
          // ✓ 檢查點1：分析檔案前檢查是否取消
          if (taskControl.isCancelled(taskId)) {
            console.log(`🛑 [檢查點1] 任務 ${taskId} 已被使用者取消，停止分析（在檔案 ${current}/${files.length} 前）`);
            return;
          }
          
          // ✓ 檢查連續失敗次數
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(`❌ 任務 ${taskId}: 連續失敗 ${consecutiveFailures} 次，停止分析`);
            throw new Error(`連續失敗 ${consecutiveFailures} 次，可能是 LLM API 服務異常`);
          }
          
          // ✓ 檢查總失敗率
          if (totalFiles > 10 && failedCount / totalFiles > MAX_TOTAL_FAILURES_RATIO) {
            console.error(`❌ 任務 ${taskId}: 失敗率過高 (${Math.round(failedCount / totalFiles * 100)}%)，停止分析`);
            throw new Error(`失敗率過高 (${failedCount}/${totalFiles})，建議檢查 LLM 配置或切換其他提供商`);
          }

          const f = files[current];
          totalFiles++;
          try {
            // 使用預先構建的 URL（支援 GitHub 和 GitLab）
            const rawUrl = f.url!;
            const headers: Record<string, string> = {};
            // 為 GitLab 新增認證 Token
            if (isGitLab) {
              // 優先使用從 URL 提取的 token，否則使用配置的 token
              let token = params.gitlabToken || (import.meta.env.VITE_GITLAB_TOKEN as string | undefined);
              
              // 如果 URL 中包含 OAuth2 token，提取它
              if (repoUrl.includes('@')) {
                try {
                  const urlObj = new URL(repoUrl);
                  if (urlObj.username === 'oauth2' && urlObj.password) {
                    token = urlObj.password;
                  } else if (urlObj.username && !urlObj.password) {
                    token = urlObj.username;
                  }
                } catch (e) {
                  // URL 解析失敗，使用原有 token
                }
              }
              
              if (token) {
                headers["PRIVATE-TOKEN"] = token;
              }
            }
            const contentRes = await fetch(rawUrl, { headers });
            if (!contentRes.ok) { await new Promise(r=>setTimeout(r, LLM_GAP_MS)); continue; }
            const content = await contentRes.text();
            if (content.length > MAX_FILE_SIZE_BYTES) { await new Promise(r=>setTimeout(r, LLM_GAP_MS)); continue; }
            totalLines += content.split(/\r?\n/).length;
            const language = (f.path.split(".").pop() || "").toLowerCase();
            const analysis = await CodeAnalysisEngine.analyzeCode(content, language);
            
            // ✓ 檢查點2：LLM分析完成後檢查是否取消（最小化浪費）
            if (taskControl.isCancelled(taskId)) {
              console.log(`🛑 [檢查點2] 任務 ${taskId} 在LLM分析完成後檢測到取消，跳過儲存結果（檔案: ${f.path}）`);
              return;
            }
            
            const issues = analysis.issues || [];
            createdIssues += issues.length;
            for (const issue of issues) {
              await api.createAuditIssue({
                task_id: taskId,
                file_path: f.path,
                line_number: issue.line || null,
                column_number: issue.column || null,
                issue_type: issue.type || "maintainability",
                severity: issue.severity || "low",
                title: issue.title || "Issue",
                description: issue.description || null,
                suggestion: issue.suggestion || null,
                code_snippet: issue.code_snippet || null,
                ai_explanation: issue.xai ? JSON.stringify(issue.xai) : (issue.ai_explanation || null),
                status: "open",
                resolved_by: null,
                resolved_at: null
              } as any);
            }
            
            // 成功：重置連續失敗計數
            consecutiveFailures = 0;
            
            // 每分析一個檔案都更新進度，確保實時性
            console.log(`📈 ${repoType}任務 ${taskId}: 進度 ${totalFiles}/${files.length} (${Math.round(totalFiles/files.length*100)}%)`);
            await api.updateAuditTask(taskId, { 
              status: "running", 
              total_files: files.length,
              scanned_files: totalFiles, 
              total_lines: totalLines, 
              issues_count: createdIssues 
            } as any);
          } catch (fileError) {
            failedCount++;
            consecutiveFailures++;
            
            // 增強錯誤日誌記錄
            const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
            console.error(`❌ 分析檔案失敗 (${f.path}): [連續失敗${consecutiveFailures}次, 總失敗${failedCount}/${totalFiles}]`);
            console.error(`   錯誤類型: ${fileError instanceof Error ? fileError.constructor.name : typeof fileError}`);
            console.error(`   錯誤詳情: ${errorMsg}`);
            
            // 檢查是否有保存的調試數據
            const debugKeys = Object.keys(localStorage).filter(k => k.startsWith('llm_response_failed_'));
            if (debugKeys.length > 0) {
              console.log(`   💾 失敗響應已保存: ${debugKeys[debugKeys.length - 1]}`);
            }
            
            // 記錄錯誤堆棧（如果有）
            if (fileError instanceof Error && fileError.stack) {
              console.error(`   錯誤堆棧: ${fileError.stack.split('\n').slice(0, 3).join('\n')}`);
            }
          }
          await new Promise(r=>setTimeout(r, LLM_GAP_MS));
        }
      };

      const pool = Array.from({ length: Math.min(LLM_CONCURRENCY, files.length) }, () => worker());
      
      try {
        await Promise.all(pool);
      } catch (workerError: any) {
        // Worker 丟擲錯誤（連續失敗或失敗率過高）
        console.error(`❌ 任務 ${taskId} 因錯誤終止:`, workerError);
        await api.updateAuditTask(taskId, { 
          status: "failed",
          total_files: files.length,
          scanned_files: totalFiles,
          total_lines: totalLines,
          issues_count: createdIssues,
          completed_at: new Date().toISOString()
        } as any);
        taskControl.cleanupTask(taskId);
        return;
      }

      // 再次檢查是否被取消
      if (taskControl.isCancelled(taskId)) {
        console.log(`🛑 任務 ${taskId} 掃描結束時檢測到取消狀態`);
        await api.updateAuditTask(taskId, { 
          status: "cancelled",
          total_files: files.length,
          scanned_files: totalFiles,
          total_lines: totalLines,
          issues_count: createdIssues,
          completed_at: new Date().toISOString()
        } as any);
        taskControl.cleanupTask(taskId);
        return;
      }

      // 計算質量評分（如果沒有問題則100分，否則根據問題數量遞減）
      const qualityScore = createdIssues === 0 ? 100 : Math.max(0, 100 - createdIssues * 2);

      await api.updateAuditTask(taskId, { 
        status: "completed", 
        total_files: files.length, 
        scanned_files: totalFiles, 
        total_lines: totalLines, 
        issues_count: createdIssues, 
        quality_score: qualityScore,
        completed_at: new Date().toISOString()
      } as any);
      
      // 記錄審計完成
      import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
        logger.info(LogCategory.SYSTEM, `審計任務完成: ${taskId}`, {
          taskId,
          totalFiles: files.length,
          scannedFiles: totalFiles,
          totalLines,
          issuesCount: createdIssues,
          qualityScore,
          failedCount,
        });
      });
      
      taskControl.cleanupTask(taskId);
    } catch (e) {
      console.error('❌ GitHub審計任務執行失敗:', e);
      console.error('錯誤詳情:', e);
      
      // 記錄審計失敗
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(e, `審計任務失敗: ${taskId}`);
      });
      
      try {
        await api.updateAuditTask(taskId, { status: "failed" } as any);
      } catch (updateError) {
        console.error('更新失敗狀態也失敗了:', updateError);
      }
    }
  })().catch(err => {
    console.error('⚠️ GitHub後臺任務未捕獲的錯誤:', err);
  });

  console.log(`✅ 返回任務ID: ${taskId}，後臺任務正在執行中...`);
  // 立即返回任務ID，讓使用者可以跳轉到任務詳情頁面
  return taskId;
}


