import { useEffect, useRef, useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Terminal, CheckCircle, XCircle, Loader2, X as XIcon } from "lucide-react";
import { cn, calculateTaskProgress } from "@/shared/utils/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { taskControl } from "@/shared/services/taskControl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TerminalProgressDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskId: string | null;
    taskType: "repository" | "zip";
}

interface LogEntry {
    timestamp: string;
    message: string;
    type: "info" | "success" | "error" | "warning";
}

export default function TerminalProgressDialog({
    open,
    onOpenChange,
    taskId,
    taskType
}: TerminalProgressDialogProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isFailed, setIsFailed] = useState(false);
    const [isCancelled, setIsCancelled] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const logsEndRef = useRef<HTMLDivElement>(null);
    const pollIntervalRef = useRef<number | null>(null);
    const hasInitializedLogsRef = useRef(false);

    // 新增日誌條目
    const addLog = (message: string, type: LogEntry["type"] = "info") => {
        const timestamp = new Date().toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        setLogs(prev => [...prev, { timestamp, message, type }]);
    };

    // 取消任務處理
    const handleCancel = async () => {
        if (!taskId) return;

        if (!confirm('確定要取消此任務嗎？已分析的結果將被保留。')) {
            return;
        }

        // 1. 標記任務為取消狀態
        taskControl.cancelTask(taskId);
        setIsCancelled(true);
        addLog("🛑 使用者取消任務，正在停止...", "error");

        // 2. 立即更新資料庫狀態
        try {
            const { api } = await import("@/shared/config/database");
            await api.updateAuditTask(taskId, { status: 'cancelled' } as any);
            addLog("✓ 任務狀態已更新為已取消", "warning");
            toast.success("任務已取消");
        } catch (error) {
            console.error('更新取消狀態失敗:', error);
            toast.warning("任務已標記取消，後臺正在停止...");
        }
    };

    // 自動滾動到底部
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // 實時更新游標處的時間
    useEffect(() => {
        if (!open || isCompleted || isFailed || isCancelled) {
            return;
        }

        const timeInterval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        }, 1000);

        return () => {
            clearInterval(timeInterval);
        };
    }, [open, isCompleted, isFailed]);

    // 輪詢任務狀態
    useEffect(() => {
        if (!open || !taskId) {
            // 清理狀態
            setLogs([]);
            setIsCompleted(false);
            setIsFailed(false);
            hasInitializedLogsRef.current = false;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        // 只初始化日誌一次（防止React嚴格模式重複）
        if (!hasInitializedLogsRef.current) {
            hasInitializedLogsRef.current = true;

            // 初始化日誌
            addLog("🚀 審計任務已啟動", "info");
            addLog(`� 任務任ID: ${taskId}`, "info");
            addLog(`� 任務類D型: ${taskType === "repository" ? "倉庫審計" : "ZIP檔案審計"}`, "info");
            addLog("⏳ 正在初始化審計環境...", "info");
        }

        let lastScannedFiles = 0;
        let lastIssuesCount = 0;
        let lastTotalLines = 0;
        let lastStatus = "";
        let pollCount = 0;
        let hasDataChange = false;
        let isFirstPoll = true;

        // 開始輪詢
        const pollTask = async () => {
            // 如果任務已完成或失敗，停止輪詢
            if (isCompleted || isFailed) {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                return;
            }

            try {
                pollCount++;
                hasDataChange = false;

                const requestStartTime = Date.now();

                // 使用 api.getAuditTaskById 獲取任務狀態
                const { api } = await import("@/shared/config/database");
                const task = await api.getAuditTaskById(taskId);

                const requestDuration = Date.now() - requestStartTime;

                if (!task) {
                    addLog(`❌ 任務不存在 (${requestDuration}ms)`, "error");
                    throw new Error("任務不存在");
                }

                // 檢查是否有資料變化
                const statusChanged = task.status !== lastStatus;
                const filesChanged = task.scanned_files !== lastScannedFiles;
                const issuesChanged = task.issues_count !== lastIssuesCount;
                const linesChanged = task.total_lines !== lastTotalLines;

                hasDataChange = statusChanged || filesChanged || issuesChanged || linesChanged;

                // 標記首次輪詢已完成
                if (isFirstPoll) {
                    isFirstPoll = false;
                }

                // 只在有變化時顯示請求/響應資訊（跳過 pending 狀態）
                if (hasDataChange && task.status !== "pending") {
                    addLog(`🔄 正在獲取任務狀態...`, "info");
                    addLog(
                        `✓ 狀態: ${task.status} | 檔案: ${task.scanned_files}/${task.total_files} | 問題: ${task.issues_count} (${requestDuration}ms)`,
                        "success"
                    );
                }

                // 更新上次狀態
                if (statusChanged) {
                    lastStatus = task.status;
                }

                // 檢查任務狀態
                if (task.status === "pending") {
                    // 靜默跳過 pending 狀態，不顯示任何日誌
                } else if (task.status === "running") {
                    // 首次進入執行狀態
                    if (statusChanged && logs.filter(l => l.message.includes("開始掃描")).length === 0) {
                        addLog("🔍 開始掃描程式碼檔案...", "info");
                        if (task.project) {
                            addLog(`📁 專案: ${task.project.name}`, "info");
                            if (task.branch_name) {
                                addLog(`🌿 分支: ${task.branch_name}`, "info");
                            }
                        }
                    }

                    // 顯示進度更新（僅在有變化時）
                    if (filesChanged && task.scanned_files > lastScannedFiles) {
                        const progress = calculateTaskProgress(task.scanned_files, task.total_files);
                        const filesProcessed = task.scanned_files - lastScannedFiles;
                        addLog(
                            `📊 掃描進度: ${task.scanned_files || 0}/${task.total_files || 0} 檔案 (${progress}%) [+${filesProcessed}]`,
                            "info"
                        );
                        lastScannedFiles = task.scanned_files;
                    }

                    // 顯示問題發現（僅在有變化時）
                    if (issuesChanged && task.issues_count > lastIssuesCount) {
                        const newIssues = task.issues_count - lastIssuesCount;
                        addLog(`⚠️  發現 ${newIssues} 個新問題 (總計: ${task.issues_count})`, "warning");
                        lastIssuesCount = task.issues_count;
                    }

                    // 顯示程式碼行數（僅在有變化時）
                    if (linesChanged && task.total_lines > lastTotalLines) {
                        const newLines = task.total_lines - lastTotalLines;
                        addLog(`📝 已分析 ${task.total_lines.toLocaleString()} 行程式碼 [+${newLines.toLocaleString()}]`, "info");
                        lastTotalLines = task.total_lines;
                    }
                } else if (task.status === "completed") {
                    // 任務完成
                    if (!isCompleted) {
                        addLog("", "info"); // 空行分隔
                        addLog("✅ 程式碼掃描完成", "success");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
                        addLog(`📊 總計掃描: ${task.total_files} 個檔案`, "success");
                        addLog(`📝 總計分析: ${task.total_lines.toLocaleString()} 行程式碼`, "success");
                        addLog(`⚠️  發現問題: ${task.issues_count} 個`, task.issues_count > 0 ? "warning" : "success");

                        // 解析問題型別分佈
                        if (task.issues_count > 0) {
                            try {
                                const { api: apiImport } = await import("@/shared/config/database");
                                const issues = await apiImport.getAuditIssues(taskId);

                                const severityCounts = {
                                    critical: issues.filter(i => i.severity === 'critical').length,
                                    high: issues.filter(i => i.severity === 'high').length,
                                    medium: issues.filter(i => i.severity === 'medium').length,
                                    low: issues.filter(i => i.severity === 'low').length
                                };

                                if (severityCounts.critical > 0) {
                                    addLog(`  🔴 嚴重: ${severityCounts.critical} 個`, "error");
                                }
                                if (severityCounts.high > 0) {
                                    addLog(`  🟠 高: ${severityCounts.high} 個`, "warning");
                                }
                                if (severityCounts.medium > 0) {
                                    addLog(`  🟡 中等: ${severityCounts.medium} 個`, "warning");
                                }
                                if (severityCounts.low > 0) {
                                    addLog(`  🟢 低: ${severityCounts.low} 個`, "info");
                                }
                            } catch (e) {
                                // 靜默處理錯誤
                            }
                        }

                        addLog(`⭐ 質量評分: ${task.quality_score.toFixed(1)}/100`, "success");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
                        addLog("🎉 審計任務已完成！", "success");

                        if (task.completed_at) {
                            const startTime = new Date(task.created_at).getTime();
                            const endTime = new Date(task.completed_at).getTime();
                            const duration = Math.round((endTime - startTime) / 1000);
                            addLog(`⏱️  總耗時: ${duration} 秒`, "info");
                        }

                        setIsCompleted(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                } else if (task.status === "cancelled") {
                    // 任務被取消
                    if (!isCancelled) {
                        addLog("", "info"); // 空行分隔
                        addLog("🛑 任務已被使用者取消", "warning");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "warning");
                        addLog(`📊 完成統計:`, "info");
                        addLog(`  • 已分析檔案: ${task.scanned_files}/${task.total_files}`, "info");
                        addLog(`  • 發現問題: ${task.issues_count} 個`, "info");
                        addLog(`  • 程式碼行數: ${task.total_lines.toLocaleString()} 行`, "info");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "warning");
                        addLog("✓ 已分析的結果已儲存到資料庫", "success");

                        setIsCancelled(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                } else if (task.status === "failed") {
                    // 任務失敗
                    if (!isFailed) {
                        addLog("", "info"); // 空行分隔
                        addLog("❌ 審計任務執行失敗", "error");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "error");

                        // 嘗試從日誌系統獲取具體錯誤資訊
                        try {
                            const { logger } = await import("@/shared/utils/logger");
                            const recentLogs = logger.getLogs({
                                startTime: Date.now() - 60000, // 最近1分鐘
                            });

                            // 查詢與當前任務相關的錯誤
                            const taskErrors = recentLogs
                                .filter(log =>
                                    log.level === 'ERROR' &&
                                    (log.message.includes(taskId) ||
                                        log.message.includes('審計') ||
                                        log.message.includes('API'))
                                )
                                .slice(-3); // 最近3條錯誤

                            if (taskErrors.length > 0) {
                                addLog("具體錯誤資訊:", "error");
                                taskErrors.forEach(log => {
                                    addLog(`  • ${log.message}`, "error");
                                    if (log.data?.error) {
                                        const errorMsg = typeof log.data.error === 'string'
                                            ? log.data.error
                                            : log.data.error.message || JSON.stringify(log.data.error);
                                        addLog(`    ${errorMsg}`, "error");
                                    }
                                });
                            } else {
                                // 如果沒有找到具體錯誤，顯示常見原因
                                addLog("可能的原因:", "error");
                                addLog("  • 網路連線問題", "error");
                                addLog("  • 倉庫訪問許可權不足（私有倉庫需配置 Token）", "error");
                                addLog("  • GitHub/GitLab API 限流", "error");
                                addLog("  • LLM API 配置錯誤或額度不足", "error");
                            }
                        } catch (e) {
                            // 如果獲取日誌失敗，顯示常見原因
                            addLog("可能的原因:", "error");
                            addLog("  • 網路連線問題", "error");
                            addLog("  • 倉庫訪問許可權不足（私有倉庫需配置 Token）", "error");
                            addLog("  • GitHub/GitLab API 限流", "error");
                            addLog("  • LLM API 配置錯誤或額度不足", "error");
                        }

                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "error");
                        addLog("💡 建議: 檢查系統配置和網路連線後重試", "warning");
                        addLog("📋 檢視完整日誌: 導航欄 -> 系統日誌", "warning");

                        setIsFailed(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                }
            } catch (error: any) {
                addLog(`❌ ${error.message || "未知錯誤"}`, "error");
                // 不中斷輪詢，繼續嘗試
            }
        };

        // 立即執行一次
        pollTask();

        // 設定定時輪詢（每2秒）
        pollIntervalRef.current = window.setInterval(pollTask, 2000);

        // 清理函式
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [open, taskId, taskType]);

    // 獲取日誌顏色 - 使用優雅的深紅色主題
    const getLogColor = (type: LogEntry["type"]) => {
        switch (type) {
            case "success":
                return "text-emerald-400";
            case "error":
                return "text-rose-400";
            case "warning":
                return "text-amber-400";
            default:
                return "text-gray-200";
        }
    };

    // 獲取狀態圖示
    const getStatusIcon = () => {
        if (isFailed) {
            return <XCircle className="w-5 h-5 text-rose-400" />;
        }
        if (isCompleted) {
            return <CheckCircle className="w-5 h-5 text-emerald-400" />;
        }
        return <Loader2 className="w-5 h-5 text-rose-400 animate-spin" />;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                <DialogOverlay />
                <DialogPrimitive.Content
                    className={cn(
                        "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
                        "w-[90vw] aspect-[16/9]",
                        "max-w-[1600px] max-h-[900px]",
                        "p-0 gap-0 rounded-lg overflow-hidden",
                        "bg-gradient-to-br from-gray-900 via-red-950/30 to-gray-900 border border-red-900/50",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "duration-200 shadow-2xl"
                    )}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    {/* 無障礙訪問標題 */}
                    <VisuallyHidden.Root>
                        <DialogPrimitive.Title>審計進度監控</DialogPrimitive.Title>
                        <DialogPrimitive.Description>
                            實時顯示程式碼審計任務的執行進度和詳細資訊
                        </DialogPrimitive.Description>
                    </VisuallyHidden.Root>

                    {/* 終端頭部 */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-950/50 to-gray-900/80 border-b border-red-900/30 backdrop-blur-sm">
                        <div className="flex items-center space-x-3">
                            <Terminal className="w-5 h-5 text-rose-400" />
                            <span className="text-sm font-medium text-gray-100">審計進度監控</span>
                            {getStatusIcon()}
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <button
                                className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 cursor-pointer transition-colors focus:outline-none"
                                onClick={() => onOpenChange(false)}
                                title="關閉"
                                aria-label="關閉"
                            />
                        </div>
                    </div>

                    {/* 終端內容 */}
                    <div className="p-6 bg-gradient-to-b from-gray-900/95 to-gray-950/95 overflow-y-auto h-[calc(100%-120px)] font-mono text-sm backdrop-blur-sm">
                        <div className="space-y-2">
                            {logs.map((log, index) => (
                                <div key={index} className="flex items-start space-x-3 hover:bg-red-950/10 px-2 py-1 rounded transition-colors">
                                    <span className="text-rose-800/70 text-xs flex-shrink-0 w-20">
                                        [{log.timestamp}]
                                    </span>
                                    <span className={`${getLogColor(log.type)} flex-1`}>
                                        {log.message}
                                    </span>
                                </div>
                            ))}

                            {/* 游標旋轉閃爍效果 */}
                            {!isCompleted && !isFailed && (
                                <div className="flex items-center space-x-2 mt-4">
                                    <span className="text-rose-800/70 text-xs w-20">[{currentTime}]</span>
                                    <span className="inline-block text-rose-400 animate-spinner font-bold text-base"></span>
                                </div>
                            )}

                            {/* 新增自定義動畫 */}
                            <style>{`
                                @keyframes spinner {
                                    0% {
                                        content: '|';
                                        opacity: 1;
                                    }
                                    25% {
                                        content: '/';
                                        opacity: 0.8;
                                    }
                                    50% {
                                        content: '—';
                                        opacity: 0.6;
                                    }
                                    75% {
                                        content: '\\\\';
                                        opacity: 0.8;
                                    }
                                    100% {
                                        content: '|';
                                        opacity: 1;
                                    }
                                }
                                .animate-spinner::before {
                                    content: '|';
                                    animation: spinner-content 0.8s linear infinite;
                                }
                                .animate-spinner {
                                    animation: spinner-opacity 0.8s ease-in-out infinite;
                                }
                                @keyframes spinner-content {
                                    0% { content: '|'; }
                                    25% { content: '/'; }
                                    50% { content: '—'; }
                                    75% { content: '\\\\'; }
                                    100% { content: '|'; }
                                }
                                @keyframes spinner-opacity {
                                    0%, 100% { opacity: 1; }
                                    25%, 75% { opacity: 0.8; }
                                    50% { opacity: 0.6; }
                                }
                            `}</style>

                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* 底部控制和提示 */}
                    <div className="px-4 py-3 bg-gradient-to-r from-red-950/50 to-gray-900/80 border-t border-red-900/30 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300">
                                {isCancelled ? "🛑 任務已取消，已分析的結果已儲存" :
                                    isCompleted ? "✅ 任務已完成，可以關閉此視窗" :
                                        isFailed ? "❌ 任務失敗，請檢查配置後重試" :
                                            "⏳ 審計進行中，請勿關閉視窗，過程可能較慢，請耐心等待......"}
                            </span>

                            <div className="flex items-center space-x-2">
                                {/* 執行中顯示取消按鈕 */}
                                {!isCompleted && !isFailed && !isCancelled && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancel}
                                        className="h-7 text-xs bg-gray-800 border-red-600 text-red-400 hover:bg-red-900 hover:text-red-200"
                                    >
                                        <XIcon className="w-3 h-3 mr-1" />
                                        取消任務
                                    </Button>
                                )}

                                {/* 失敗時顯示檢視日誌按鈕 */}
                                {isFailed && (
                                    <button
                                        onClick={() => {
                                            window.open('/logs', '_blank');
                                        }}
                                        className="px-4 py-1.5 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white rounded text-xs transition-all shadow-lg shadow-yellow-900/50 font-medium"
                                    >
                                        📋 檢視日誌
                                    </button>
                                )}

                                {/* 已完成/失敗/取消顯示關閉按鈕 */}
                                {(isCompleted || isFailed || isCancelled) && (
                                    <button
                                        onClick={() => onOpenChange(false)}
                                        className="px-4 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded text-xs transition-all shadow-lg shadow-rose-900/50 font-medium"
                                    >
                                        關閉
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    );
}
