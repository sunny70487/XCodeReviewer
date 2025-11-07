import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search,
  FileText,
  Calendar,
  Plus
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { AuditTask } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import { calculateTaskProgress } from "@/shared/utils/utils";

export default function AuditTasks() {
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  // 靜默更新活動任務的進度（不觸發loading狀態）
  useEffect(() => {
    const activeTasks = tasks.filter(
      task => task.status === 'running' || task.status === 'pending'
    );

    if (activeTasks.length === 0) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        // 只獲取活動任務的最新資料
        const updatedData = await api.getAuditTasks();
        
        // 使用函式式更新，確保基於最新狀態
        setTasks(prevTasks => {
          return prevTasks.map(prevTask => {
            const updated = updatedData.find(t => t.id === prevTask.id);
            // 只有在進度、狀態或問題數真正變化時才更新
            if (updated && (
              updated.status !== prevTask.status ||
              updated.scanned_files !== prevTask.scanned_files ||
              updated.issues_count !== prevTask.issues_count
            )) {
              return updated;
            }
            return prevTask;
          });
        });
      } catch (error) {
        console.error('靜默更新任務列表失敗:', error);
      }
    }, 3000); // 每3秒靜默更新一次

    return () => clearInterval(intervalId);
  }, [tasks.map(t => t.id + t.status).join(',')]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error("載入任務失敗");
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.task_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 頁面標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">審計任務</h1>
          <p className="page-subtitle">檢視和管理所有程式碼審計任務的執行狀態</p>
        </div>
        <Button className="btn-primary" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          新建任務
        </Button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">總任務數</p>
                <p className="stat-value text-xl">{tasks.length}</p>
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
                <p className="stat-label">已完成</p>
                <p className="stat-value text-xl">{tasks.filter(t => t.status === 'completed').length}</p>
              </div>
              <div className="stat-icon from-emerald-500 to-emerald-600">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">執行中</p>
                <p className="stat-value text-xl">{tasks.filter(t => t.status === 'running').length}</p>
              </div>
              <div className="stat-icon from-orange-500 to-orange-600">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">失敗</p>
                <p className="stat-value text-xl">{tasks.filter(t => t.status === 'failed').length}</p>
              </div>
              <div className="stat-icon from-red-500 to-red-600">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜尋和篩選 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜尋專案名稱或任務型別..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                全部
              </Button>
              <Button
                variant={statusFilter === "running" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("running")}
              >
                執行中
              </Button>
              <Button
                variant={statusFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("completed")}
              >
                已完成
              </Button>
              <Button
                variant={statusFilter === "failed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("failed")}
              >
                失敗
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 任務列表 */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="card-modern group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      task.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                      task.status === 'running' ? 'bg-red-50 text-red-600' :
                      task.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getStatusIcon(task.status)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 group-hover:text-primary transition-colors">
                        {task.project?.name || '未知專案'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {task.task_type === 'repository' ? '倉庫審計任務' : '即時分析任務'}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status === 'completed' ? '已完成' : 
                     task.status === 'running' ? '執行中' : 
                     task.status === 'failed' ? '失敗' :
                     task.status === 'cancelled' ? '已取消' : '等待中'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100/30 rounded-xl border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600 mb-1">{task.total_files}</div>
                    <p className="text-xs text-blue-700 font-medium">檔案數</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100/30 rounded-xl border border-purple-200">
                    <div className="text-2xl font-bold text-purple-600 mb-1">{task.total_lines.toLocaleString()}</div>
                    <p className="text-xs text-purple-700 font-medium">程式碼行數</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100/30 rounded-xl border border-orange-200">
                    <div className="text-2xl font-bold text-orange-600 mb-1">{task.issues_count}</div>
                    <p className="text-xs text-orange-700 font-medium">發現問題</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100/30 rounded-xl border border-green-200">
                    <div className="text-2xl font-bold text-green-600 mb-1">{task.quality_score.toFixed(1)}</div>
                    <p className="text-xs text-green-700 font-medium">質量評分</p>
                  </div>
                </div>

                {/* 掃描進度 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">掃描進度</span>
                    <span className="text-sm text-gray-500">
                      {task.scanned_files || 0} / {task.total_files || 0} 檔案
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-300"
                      style={{ width: `${calculateTaskProgress(task.scanned_files, task.total_files)}%` }}
                    ></div>
                  </div>
                  <div className="text-right mt-1">
                    <span className="text-xs text-gray-500">
                      {calculateTaskProgress(task.scanned_files, task.total_files)}% 完成
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(task.created_at)}
                    </div>
                    {task.completed_at && (
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {formatDate(task.completed_at)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <Link to={`/tasks/${task.id}`}>
                      <Button variant="outline" size="sm" className="btn-secondary">
                        <FileText className="w-4 h-4 mr-2" />
                        檢視詳情
                      </Button>
                    </Link>
                    {task.project && (
                      <Link to={`/projects/${task.project.id}`}>
                        <Button size="sm" className="btn-primary">
                          檢視專案
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="card-modern">
          <CardContent className="empty-state py-16">
            <div className="empty-icon">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== "all" ? '未找到匹配的任務' : '暫無審計任務'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
              {searchTerm || statusFilter !== "all" ? '嘗試調整搜尋條件或篩選器' : '建立第一個審計任務開始程式碼質量分析'}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button className="btn-primary" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                建立任務
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 新建任務對話方塊 */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTaskCreated={loadTasks}
      />
    </div>
  );
}