import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Calendar,
  GitBranch,
  Shield,
  Bug,
  TrendingUp,
  Download,
  Code,
  Lightbulb,
  Info,
  Zap,
  X
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { AuditTask, AuditIssue } from "@/shared/types";
import { toast } from "sonner";
import ExportReportDialog from "@/components/reports/ExportReportDialog";
import { calculateTaskProgress } from "@/shared/utils/utils";
import { taskControl } from "@/shared/services/taskControl";

// AI解釋解析函式
function parseAIExplanation(aiExplanation: string) {
  try {
    const parsed = JSON.parse(aiExplanation);
    // 檢查是否有xai欄位
    if (parsed.xai) {
      return parsed.xai;
    }
    // 檢查是否直接包含what, why, how欄位
    if (parsed.what || parsed.why || parsed.how) {
      return parsed;
    }
    // 如果都沒有，返回null表示無法解析
    return null;
  } catch (error) {
    // JSON解析失敗，返回null
    return null;
  }
}

// 問題列表元件
function IssuesList({ issues }: { issues: AuditIssue[] }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'security': return <Shield className="w-4 h-4" />;
      case 'bug': return <AlertTriangle className="w-4 h-4" />;
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'style': return <Code className="w-4 h-4" />;
      case 'maintainability': return <FileText className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const criticalIssues = issues.filter(issue => issue.severity === 'critical');
  const highIssues = issues.filter(issue => issue.severity === 'high');
  const mediumIssues = issues.filter(issue => issue.severity === 'medium');
  const lowIssues = issues.filter(issue => issue.severity === 'low');

  const renderIssue = (issue: AuditIssue, index: number) => (
    <div key={issue.id || index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${issue.severity === 'critical' ? 'bg-red-100 text-red-600' :
            issue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
              issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                'bg-blue-100 text-blue-600'
            }`}>
            {getTypeIcon(issue.issue_type)}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-base text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">{issue.title}</h4>
            <div className="flex items-center space-x-1 text-xs text-gray-600">
              <FileText className="w-3 h-3" />
              <span className="font-medium">{issue.file_path}</span>
            </div>
            {issue.line_number && (
              <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                <span>📍</span>
                <span>第 {issue.line_number} 行</span>
                {issue.column_number && <span>，第 {issue.column_number} 列</span>}
              </div>
            )}
          </div>
        </div>
        <Badge className={`${getSeverityColor(issue.severity)} px-2 py-1 text-xs font-medium`}>
          {issue.severity === 'critical' ? '嚴重' :
            issue.severity === 'high' ? '高' :
              issue.severity === 'medium' ? '中等' : '低'}
        </Badge>
      </div>

      {issue.description && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
          <div className="flex items-center mb-1">
            <Info className="w-3 h-3 text-gray-600 mr-1" />
            <span className="font-medium text-gray-800 text-xs">問題詳情</span>
          </div>
          <p className="text-gray-700 text-xs leading-relaxed">
            {issue.description}
          </p>
        </div>
      )}

      {issue.code_snippet && (
        <div className="bg-gray-900 rounded-lg p-3 mb-3 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
                <Code className="w-2 h-2 text-white" />
              </div>
              <span className="text-gray-300 text-xs font-medium">問題程式碼</span>
            </div>
            {issue.line_number && (
              <span className="text-gray-400 text-xs">第 {issue.line_number} 行</span>
            )}
          </div>
          <div className="bg-black/40 rounded p-2">
            <pre className="text-xs text-gray-100 overflow-x-auto">
              <code>{issue.code_snippet}</code>
            </pre>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {issue.suggestion && (
          <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center mb-2">
              <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center mr-2">
                <Lightbulb className="w-3 h-3 text-white" />
              </div>
              <span className="font-medium text-blue-800 text-sm">修復建議</span>
            </div>
            <p className="text-blue-700 text-xs leading-relaxed">{issue.suggestion}</p>
          </div>
        )}

        {issue.ai_explanation && (() => {
          const parsedExplanation = parseAIExplanation(issue.ai_explanation);

          if (parsedExplanation) {
            return (
              <div className="bg-white border border-red-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center mb-2">
                  <div className="w-5 h-5 bg-red-600 rounded flex items-center justify-center mr-2">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium text-red-800 text-sm">AI 解釋</span>
                </div>

                <div className="space-y-2 text-xs">
                  {parsedExplanation.what && (
                    <div className="border-l-2 border-red-600 pl-2">
                      <span className="font-medium text-red-700">問題：</span>
                      <span className="text-gray-700 ml-1">{parsedExplanation.what}</span>
                    </div>
                  )}

                  {parsedExplanation.why && (
                    <div className="border-l-2 border-gray-600 pl-2">
                      <span className="font-medium text-gray-700">原因：</span>
                      <span className="text-gray-700 ml-1">{parsedExplanation.why}</span>
                    </div>
                  )}

                  {parsedExplanation.how && (
                    <div className="border-l-2 border-black pl-2">
                      <span className="font-medium text-black">方案：</span>
                      <span className="text-gray-700 ml-1">{parsedExplanation.how}</span>
                    </div>
                  )}

                  {parsedExplanation.learn_more && (
                    <div className="border-l-2 border-red-400 pl-2">
                      <span className="font-medium text-red-600">連結：</span>
                      <a
                        href={parsedExplanation.learn_more}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:text-red-800 hover:underline ml-1"
                      >
                        {parsedExplanation.learn_more}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          } else {
            // 如果無法解析JSON，回退到原始顯示方式
            return (
              <div className="bg-white border border-red-200 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <Zap className="w-4 h-4 text-red-600 mr-2" />
                  <span className="font-medium text-red-800 text-sm">AI 解釋</span>
                </div>
                <p className="text-gray-700 text-xs leading-relaxed">{issue.ai_explanation}</p>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );

  if (issues.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-green-800 mb-3">程式碼質量優秀！</h3>
        <p className="text-green-600 text-lg mb-6">恭喜！沒有發現任何問題</p>
        <div className="bg-green-50 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-green-700 text-sm">
            您的程式碼透過了所有質量檢查，包括安全性、效能、可維護性等各個方面的評估。
          </p>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-5 mb-6">
        <TabsTrigger value="all" className="text-sm">
          全部 ({issues.length})
        </TabsTrigger>
        <TabsTrigger value="critical" className="text-sm">
          嚴重 ({criticalIssues.length})
        </TabsTrigger>
        <TabsTrigger value="high" className="text-sm">
          高 ({highIssues.length})
        </TabsTrigger>
        <TabsTrigger value="medium" className="text-sm">
          中等 ({mediumIssues.length})
        </TabsTrigger>
        <TabsTrigger value="low" className="text-sm">
          低 ({lowIssues.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="space-y-4 mt-6">
        {issues.map((issue, index) => renderIssue(issue, index))}
      </TabsContent>

      <TabsContent value="critical" className="space-y-4 mt-6">
        {criticalIssues.length > 0 ? (
          criticalIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">沒有發現嚴重問題</h3>
            <p className="text-gray-500">程式碼在嚴重級別的檢查中表現良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="high" className="space-y-4 mt-6">
        {highIssues.length > 0 ? (
          highIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">沒有發現高優先順序問題</h3>
            <p className="text-gray-500">程式碼在高優先順序檢查中表現良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="medium" className="space-y-4 mt-6">
        {mediumIssues.length > 0 ? (
          mediumIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">沒有發現中等優先順序問題</h3>
            <p className="text-gray-500">程式碼在中等優先順序檢查中表現良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="low" className="space-y-4 mt-6">
        {lowIssues.length > 0 ? (
          lowIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">沒有發現低優先順序問題</h3>
            <p className="text-gray-500">程式碼在低優先順序檢查中表現良好</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<AuditTask | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadTaskDetail();
    }
  }, [id]);

  // 對於執行中或等待中的任務，靜默更新進度（不觸發loading狀態）
  useEffect(() => {
    if (!task || !id) {
      return;
    }

    // 執行中或等待中的任務需要定時更新
    if (task.status === 'running' || task.status === 'pending') {
      const intervalId = setInterval(async () => {
        try {
          // 靜默獲取任務資料，不觸發loading狀態
          const [taskData, issuesData] = await Promise.all([
            api.getAuditTaskById(id),
            api.getAuditIssues(id)
          ]);

          // 只有資料真正變化時才更新狀態
          if (taskData && (
            taskData.status !== task.status ||
            taskData.scanned_files !== task.scanned_files ||
            taskData.issues_count !== task.issues_count
          )) {
            setTask(taskData);
            setIssues(issuesData);
          }
        } catch (error) {
          console.error('靜默更新任務失敗:', error);
        }
      }, 3000); // 每3秒靜默更新一次

      return () => clearInterval(intervalId);
    }
  }, [task?.status, task?.scanned_files, id]);

  const loadTaskDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [taskData, issuesData] = await Promise.all([
        api.getAuditTaskById(id),
        api.getAuditIssues(id)
      ]);

      setTask(taskData);
      setIssues(issuesData);
    } catch (error) {
      console.error('Failed to load task detail:', error);
      toast.error("載入任務詳情失敗");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-red-50 text-red-800';
      case 'failed': return 'bg-red-100 text-red-900';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      case 'cancelled': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };


  const handleCancel = async () => {
    if (!id || !task) return;
    
    if (!confirm('確定要取消此任務嗎？已分析的結果將被保留。')) {
      return;
    }
    
    // 1. 標記任務為取消狀態（讓後臺迴圈檢測到）
    taskControl.cancelTask(id);
    
    // 2. 立即更新本地狀態顯示
    setTask(prev => prev ? { ...prev, status: 'cancelled' as const } : prev);
    
    // 3. 嘗試立即更新資料庫（後臺也會更新，這裡是雙保險）
    try {
      await api.updateAuditTask(id, { status: 'cancelled' } as any);
      toast.success("任務已取消");
    } catch (error) {
      console.error('更新取消狀態失敗:', error);
      toast.warning("任務已標記取消，後臺正在停止...");
    }
    
    // 4. 1秒後再次重新整理，確保顯示最新狀態
    setTimeout(() => {
      loadTaskDetail();
    }, 1000);
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center space-x-4">
          <Link to="/audit-tasks">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回任務列表
            </Button>
          </Link>
        </div>
        <Card className="card-modern">
          <CardContent className="empty-state py-16">
            <div className="empty-icon">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">任務不存在</h3>
            <p className="text-gray-500">請檢查任務ID是否正確</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 使用公共函式計算進度百分比
  const progressPercentage = calculateTaskProgress(task.scanned_files, task.total_files);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/audit-tasks">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回任務列表
            </Button>
          </Link>
          <div>
            <h1 className="page-title">任務詳情</h1>
            <p className="page-subtitle">{task.project?.name || '未知專案'} - 審計任務</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Badge className={getStatusColor(task.status)}>
            {getStatusIcon(task.status)}
            <span className="ml-2">
              {task.status === 'completed' ? '已完成' :
                task.status === 'running' ? '執行中' :
                  task.status === 'failed' ? '失敗' :
                    task.status === 'cancelled' ? '已取消' : '等待中'}
            </span>
          </Badge>
          
          {/* 執行中或等待中的任務顯示取消按鈕 */}
          {(task.status === 'running' || task.status === 'pending') && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleCancel}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-2" />
              取消任務
            </Button>
          )}
          
          {/* 已完成的任務顯示匯出按鈕 */}
          {task.status === 'completed' && (
            <Button 
              size="sm" 
              className="btn-primary"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="w-4 h-4 mr-2" />
              匯出報告
            </Button>
          )}
        </div>
      </div>

      {/* 任務概覽 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">掃描進度</p>
                <p className="stat-value text-xl">{progressPercentage}%</p>
                <Progress value={progressPercentage} className="mt-2" />
              </div>
              <div className="stat-icon from-primary to-accent">
                <Activity className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">發現問題</p>
                <p className="stat-value text-xl text-orange-600">{task.issues_count}</p>
              </div>
              <div className="stat-icon from-orange-500 to-orange-600">
                <Bug className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">質量評分</p>
                <p className="stat-value text-xl text-primary">{task.quality_score.toFixed(1)}</p>
              </div>
              <div className="stat-icon from-emerald-500 to-emerald-600">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">程式碼行數</p>
                <p className="stat-value text-xl">{task.total_lines.toLocaleString()}</p>
              </div>
              <div className="stat-icon from-purple-500 to-purple-600">
                <FileText className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任務資訊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-primary" />
                <span>任務資訊</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">任務型別</p>
                  <p className="text-base">
                    {task.task_type === 'repository' ? '倉庫審計任務' : '即時分析任務'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">目標分支</p>
                  <p className="text-base flex items-center">
                    <GitBranch className="w-4 h-4 mr-1" />
                    {task.branch_name || '預設分支'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">建立時間</p>
                  <p className="text-base flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(task.created_at)}
                  </p>
                </div>
                {task.completed_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">完成時間</p>
                    <p className="text-base flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {formatDate(task.completed_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* 排除模式 */}
              {task.exclude_patterns && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">排除模式</p>
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(task.exclude_patterns).map((pattern: string) => (
                      <Badge key={pattern} variant="outline" className="text-xs">
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 掃描配置 */}
              {task.scan_config && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">掃描配置</p>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <pre className="text-xs text-gray-600">
                      {JSON.stringify(JSON.parse(task.scan_config), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>專案資訊</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.project ? (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-500">專案名稱</p>
                    <Link to={`/projects/${task.project.id}`} className="text-base text-primary hover:underline">
                      {task.project.name}
                    </Link>
                  </div>
                  {task.project.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">專案描述</p>
                      <p className="text-sm text-gray-600">{task.project.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">倉庫型別</p>
                    <p className="text-base">{task.project.repository_type?.toUpperCase() || 'OTHER'}</p>
                  </div>
                  {task.project.programming_languages && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">程式語言</p>
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(task.project.programming_languages).map((lang: string) => (
                          <Badge key={lang} variant="secondary" className="text-xs">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">專案資訊不可用</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 問題列表 */}
      {issues.length > 0 && (
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bug className="w-6 h-6 text-orange-600" />
              <span>發現的問題 ({issues.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IssuesList issues={issues} />
          </CardContent>
        </Card>
      )}

      {/* 匯出報告對話方塊 */}
      {task && (
        <ExportReportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          task={task}
          issues={issues}
        />
      )}
    </div>
  );
}