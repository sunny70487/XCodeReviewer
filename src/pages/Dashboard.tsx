import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Activity, AlertTriangle, Clock, Code,
  FileText, GitBranch, Shield, TrendingUp, Zap,
  BarChart3, Target, ArrowUpRight, Calendar
} from "lucide-react";
import { api, dbMode, isDemoMode } from "@/shared/config/database";
import type { Project, AuditTask, ProjectStats } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentTasks, setRecentTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueTypeData, setIssueTypeData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [qualityTrendData, setQualityTrendData] = useState<Array<{ date: string; score: number }>>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const results = await Promise.allSettled([
        api.getProjectStats(),
        api.getProjects(),
        api.getAuditTasks()
      ]);

      // 統計資料 - 使用真實資料或空資料
      if (results[0].status === 'fulfilled') {
        setStats(results[0].value);
      } else {
        console.error('獲取統計資料失敗:', results[0].reason);
        // 使用空資料而不是假資料
        setStats({
          total_projects: 0,
          active_projects: 0,
          total_tasks: 0,
          completed_tasks: 0,
          total_issues: 0,
          resolved_issues: 0,
          avg_quality_score: 0
        });
      }

      // 專案列表 - 使用真實資料
      if (results[1].status === 'fulfilled') {
        setRecentProjects(Array.isArray(results[1].value) ? results[1].value.slice(0, 5) : []);
      } else {
        console.error('獲取專案列表失敗:', results[1].reason);
        setRecentProjects([]);
      }

      // 任務列表 - 使用真實資料
      let tasks: AuditTask[] = [];
      if (results[2].status === 'fulfilled') {
        tasks = Array.isArray(results[2].value) ? results[2].value : [];
        setRecentTasks(tasks.slice(0, 10));
      } else {
        console.error('獲取任務列表失敗:', results[2].reason);
        setRecentTasks([]);
      }

      // 基於真實任務資料生成質量趨勢
      if (tasks.length > 0) {
        // 按日期分組計算平均質量分
        const tasksByDate = tasks
          .filter(t => t.completed_at && t.quality_score > 0)
          .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
          .slice(-6); // 最近6個任務

        const trendData = tasksByDate.map((task, index) => ({
          date: new Date(task.completed_at!).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          score: task.quality_score
        }));

        setQualityTrendData(trendData.length > 0 ? trendData : []);
      } else {
        setQualityTrendData([]);
      }

      // 基於真實資料生成問題型別分佈
      // 需要獲取所有問題資料來統計
      try {
        const allIssues = await Promise.all(
          tasks.map(task => api.getAuditIssues(task.id).catch(() => []))
        );
        const flatIssues = allIssues.flat();

        if (flatIssues.length > 0) {
          const typeCount: Record<string, number> = {};
          flatIssues.forEach(issue => {
            typeCount[issue.issue_type] = (typeCount[issue.issue_type] || 0) + 1;
          });

          const typeMap: Record<string, { name: string; color: string }> = {
            security: { name: '安全問題', color: '#dc2626' },
            bug: { name: '潛在Bug', color: '#7f1d1d' },
            performance: { name: '效能問題', color: '#b91c1c' },
            style: { name: '程式碼風格', color: '#991b1b' },
            maintainability: { name: '可維護性', color: '#450a0a' }
          };

          const issueData = Object.entries(typeCount).map(([type, count]) => ({
            name: typeMap[type]?.name || type,
            value: count,
            color: typeMap[type]?.color || '#6b7280'
          }));

          setIssueTypeData(issueData);
        } else {
          setIssueTypeData([]);
        }
      } catch (error) {
        console.error('獲取問題資料失敗:', error);
        setIssueTypeData([]);
      }
    } catch (error) {
      console.error('儀表盤資料載入失敗:', error);
      toast.error("資料載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'running': return 'bg-red-50 text-red-700 border-red-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600">載入儀表盤資料...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Simplified Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">儀表盤</h1>
          <p className="page-subtitle">
            實時監控專案狀態，掌握程式碼質量動態
            {isDemoMode && <Badge variant="outline" className="ml-2">演示模式</Badge>}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/instant-analysis">
            <Button className="btn-primary">
              <Zap className="w-4 h-4 mr-2" />
              即時分析
            </Button>
          </Link>
          <Link to="/projects">
            <Button variant="outline" className="btn-secondary">
              <GitBranch className="w-4 h-4 mr-2" />
              新建專案
            </Button>
          </Link>
        </div>
      </div>

      {/* 資料庫模式提示 */}
      {isDemoMode && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            當前使用<strong>演示模式</strong>，顯示的是模擬資料。
            配置資料庫後將顯示真實資料。
            <Link to="/admin" className="ml-2 text-primary hover:underline">
              前往資料庫管理 →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">總專案數</p>
                <p className="stat-value">{stats?.total_projects || 0}</p>
                <p className="text-xs text-gray-500 mt-1">活躍 {stats?.active_projects || 0} 個</p>
              </div>
              <div className="stat-icon from-primary to-accent group-hover:scale-110 transition-transform">
                <Code className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">審計任務</p>
                <p className="stat-value">{stats?.total_tasks || 0}</p>
                <p className="text-xs text-gray-500 mt-1">已完成 {stats?.completed_tasks || 0} 個</p>
              </div>
              <div className="stat-icon from-emerald-500 to-emerald-600 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">發現問題</p>
                <p className="stat-value">{stats?.total_issues || 0}</p>
                <p className="text-xs text-gray-500 mt-1">已解決 {stats?.resolved_issues || 0} 個</p>
              </div>
              <div className="stat-icon from-orange-500 to-orange-600 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">平均質量分</p>
                <p className="stat-value">
                  {stats?.avg_quality_score ? stats.avg_quality_score.toFixed(1) : '0.0'}
                </p>
                {stats?.avg_quality_score ? (
                  <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    <span>持續改進中</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">暫無資料</p>
                )}
              </div>
              <div className="stat-icon from-purple-500 to-purple-600 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - 重新設計為更緊湊的佈局 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* 左側主要內容區 */}
        <div className="xl:col-span-3 space-y-4">
          {/* 圖表區域 - 使用更緊湊的網格佈局 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 質量趨勢圖 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                  程式碼質量趨勢
                </CardTitle>
              </CardHeader>
              <CardContent>
                {qualityTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={qualityTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暫無質量趨勢資料</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 問題分佈圖 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <BarChart3 className="w-5 h-5 mr-2 text-accent" />
                  問題型別分佈
                </CardTitle>
              </CardHeader>
              <CardContent>
                {issueTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={issueTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {issueTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暫無問題分佈資料</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 專案概覽 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <FileText className="w-5 h-5 mr-2 text-primary" />
                專案概覽
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentProjects.length > 0 ? (
                  recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="block p-4 rounded-lg border border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 group-hover:text-primary transition-colors truncate">
                          {project.name}
                        </h4>
                        <Badge
                          variant={project.is_active ? "default" : "secondary"}
                          className="ml-2 flex-shrink-0"
                        >
                          {project.is_active ? '活躍' : '暫停'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                        {project.description || '暫無描述'}
                      </p>
                      <div className="flex items-center text-xs text-gray-400">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <Code className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暫無專案</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 最近任務 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg">
                  <Clock className="w-5 h-5 mr-2 text-emerald-600" />
                  最近任務
                </CardTitle>
                <Link to="/audit-tasks">
                  <Button variant="ghost" size="sm" className="hover:bg-emerald-50 hover:text-emerald-700">
                    檢視全部
                    <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTasks.length > 0 ? (
                  recentTasks.slice(0, 6).map((task) => (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                          task.status === 'running' ? 'bg-red-50 text-red-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                          {task.status === 'completed' ? <Activity className="w-4 h-4" /> :
                            task.status === 'running' ? <Clock className="w-4 h-4" /> :
                              <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900 group-hover:text-primary transition-colors">
                            {task.project?.name || '未知專案'}
                          </p>
                          <p className="text-xs text-gray-500">
                            質量分: {task.quality_score?.toFixed(1) || '0.0'}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status === 'completed' ? '完成' :
                          task.status === 'running' ? '執行中' : '失敗'}
                      </Badge>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暫無任務</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右側邊欄 - 緊湊設計 */}
        <div className="xl:col-span-1 space-y-4">
          {/* 快速操作 */}
          <Card className="card-modern bg-gradient-to-br from-red-50/30 via-background to-red-50/20 border border-red-100/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Zap className="w-5 h-5 mr-2 text-indigo-600" />
                快速操作
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/instant-analysis" className="block">
                <Button className="w-full justify-start btn-primary">
                  <Zap className="w-4 h-4 mr-2" />
                  即時程式碼分析
                </Button>
              </Link>
              <Link to="/projects" className="block">
                <Button variant="outline" className="w-full justify-start btn-secondary">
                  <GitBranch className="w-4 h-4 mr-2" />
                  建立新專案
                </Button>
              </Link>
              <Link to="/audit-tasks" className="block">
                <Button variant="outline" className="w-full justify-start btn-secondary">
                  <Shield className="w-4 h-4 mr-2" />
                  啟動審計任務
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 系統狀態 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Activity className="w-5 h-5 mr-2 text-emerald-600" />
                系統狀態
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">資料庫模式</span>
                <Badge className={
                  dbMode === 'local' ? 'bg-blue-100 text-blue-700' :
                    dbMode === 'supabase' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                }>
                  {dbMode === 'local' ? '本地' : dbMode === 'supabase' ? '雲端' : '演示'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">活躍專案</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats?.active_projects || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">執行中任務</span>
                <span className="text-sm font-medium text-gray-900">
                  {recentTasks.filter(t => t.status === 'running').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">待解決問題</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats ? stats.total_issues - stats.resolved_issues : 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 最新活動 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Clock className="w-5 h-5 mr-2 text-orange-600" />
                最新活動
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTasks.length > 0 ? (
                recentTasks.slice(0, 3).map((task) => {
                  const timeAgo = (() => {
                    const now = new Date();
                    const taskDate = new Date(task.created_at);
                    const diffMs = now.getTime() - taskDate.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 60) return `${diffMins}分鐘前`;
                    if (diffHours < 24) return `${diffHours}小時前`;
                    return `${diffDays}天前`;
                  })();

                  const bgColor =
                    task.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                      task.status === 'running' ? 'bg-blue-50 border-blue-200' :
                        task.status === 'failed' ? 'bg-red-50 border-red-200' :
                          'bg-gray-50 border-gray-200';

                  const textColor =
                    task.status === 'completed' ? 'text-emerald-900' :
                      task.status === 'running' ? 'text-blue-900' :
                        task.status === 'failed' ? 'text-red-900' :
                          'text-gray-900';

                  const descColor =
                    task.status === 'completed' ? 'text-emerald-700' :
                      task.status === 'running' ? 'text-blue-700' :
                        task.status === 'failed' ? 'text-red-700' :
                          'text-gray-700';

                  const timeColor =
                    task.status === 'completed' ? 'text-emerald-600' :
                      task.status === 'running' ? 'text-blue-600' :
                        task.status === 'failed' ? 'text-red-600' :
                          'text-gray-600';

                  const statusText =
                    task.status === 'completed' ? '任務完成' :
                      task.status === 'running' ? '任務執行中' :
                        task.status === 'failed' ? '任務失敗' :
                          '任務待處理';

                  return (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      className={`block p-3 rounded-lg border ${bgColor} hover:shadow-sm transition-shadow`}
                    >
                      <p className={`text-sm font-medium ${textColor}`}>{statusText}</p>
                      <p className={`text-xs ${descColor} mt-1 line-clamp-1`}>
                        專案 "{task.project?.name || '未知專案'}"
                        {task.status === 'completed' && task.issues_count > 0 &&
                          ` - 發現 ${task.issues_count} 個問題`
                        }
                      </p>
                      <p className={`text-xs ${timeColor} mt-1`}>{timeAgo}</p>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暫無活動記錄</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 使用技巧 */}
          <Card className="card-modern bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Target className="w-5 h-5 mr-2 text-purple-600" />
                使用技巧
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-gray-700">定期執行程式碼審計可以及早發現潛在問題</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-gray-700">使用即時分析功能快速檢查程式碼片段</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-gray-700">關注質量評分趨勢，持續改進程式碼質量</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
