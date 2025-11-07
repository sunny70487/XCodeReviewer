import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  HardDrive,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Clock,
  AlertTriangle,
  TrendingUp,
  Package,
  Settings
} from "lucide-react";
import { api, dbMode, isLocalMode } from "@/shared/config/database";
import { DatabaseManager } from "@/components/database/DatabaseManager";
import { DatabaseStatusDetail } from "@/components/database/DatabaseStatus";
import { SystemConfig } from "@/components/system/SystemConfig";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalIssues: 0,
    resolvedIssues: 0,
    storageUsed: '計算中...',
    storageQuota: '未知'
  });
  const [loading, setLoading] = useState(true);
  const [storageDetails, setStorageDetails] = useState<{
    usage: number;
    quota: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const projectStats = await api.getProjectStats();

      // 獲取儲存使用量（IndexedDB）
      let storageUsed = '未知';
      let storageQuota = '未知';
      let details = null;

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          const usedMB = ((estimate.usage || 0) / 1024 / 1024).toFixed(2);
          const quotaMB = ((estimate.quota || 0) / 1024 / 1024).toFixed(2);
          const percentage = estimate.quota ? ((estimate.usage || 0) / estimate.quota * 100) : 0;

          storageUsed = `${usedMB} MB`;
          storageQuota = `${quotaMB} MB`;

          details = {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
            percentage: Math.round(percentage)
          };
        } catch (e) {
          console.error('Failed to estimate storage:', e);
        }
      }

      setStats({
        totalProjects: projectStats.total_projects || 0,
        activeProjects: projectStats.active_projects || 0,
        totalTasks: projectStats.total_tasks || 0,
        completedTasks: projectStats.completed_tasks || 0,
        totalIssues: projectStats.total_issues || 0,
        resolvedIssues: projectStats.resolved_issues || 0,
        storageUsed,
        storageQuota
      });

      setStorageDetails(details);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error("載入統計資料失敗");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">載入資料庫資訊...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            系統管理
          </h1>
          <p className="text-gray-600 mt-2">
            管理系統配置、LLM設定、資料庫和儲存使用情況
          </p>
        </div>
        <Button variant="outline" onClick={loadStats}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重新整理資料
        </Button>
      </div>

      {/* 資料庫模式提示 */}
      {!isLocalMode && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            當前使用 <strong>{dbMode === 'supabase' ? 'Supabase 雲端' : '演示'}</strong> 模式。
            資料庫管理功能僅在本地資料庫模式下完全可用。
            {dbMode === 'demo' && ' 請在 .env 檔案中配置 VITE_USE_LOCAL_DB=true 啟用本地資料庫。'}
          </AlertDescription>
        </Alert>
      )}

      {/* 資料庫狀態卡片 */}
      <DatabaseStatusDetail />

      {/* 統計概覽 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">專案總數</p>
                <p className="text-3xl font-bold mt-2">{stats.totalProjects}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  活躍: {stats.activeProjects}
                </p>
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">審計任務</p>
                <p className="text-3xl font-bold mt-2">{stats.totalTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  已完成: {stats.completedTasks}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">發現問題</p>
                <p className="text-3xl font-bold mt-2">{stats.totalIssues}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  已解決: {stats.resolvedIssues}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">儲存使用</p>
                <p className="text-3xl font-bold mt-2">{stats.storageUsed}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  配額: {stats.storageQuota}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <HardDrive className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要內容標籤頁 */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="config">系統配置</TabsTrigger>
          <TabsTrigger value="overview">資料概覽</TabsTrigger>
          <TabsTrigger value="storage">儲存管理</TabsTrigger>
          <TabsTrigger value="operations">資料操作</TabsTrigger>
          <TabsTrigger value="settings">高階設定</TabsTrigger>
        </TabsList>

        {/* 系統配置 */}
        <TabsContent value="config" className="space-y-6">
          <SystemConfig />
        </TabsContent>

        {/* 資料概覽 */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 任務完成率 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  任務完成率
                </CardTitle>
                <CardDescription>審計任務的完成情況統計</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>已完成</span>
                    <span className="font-medium">
                      {stats.totalTasks > 0
                        ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={stats.totalTasks > 0
                      ? (stats.completedTasks / stats.totalTasks) * 100
                      : 0
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">總任務數</p>
                    <p className="text-2xl font-bold">{stats.totalTasks}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">已完成</p>
                    <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 問題解決率 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  問題解決率
                </CardTitle>
                <CardDescription>程式碼問題的解決情況統計</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>已解決</span>
                    <span className="font-medium">
                      {stats.totalIssues > 0
                        ? Math.round((stats.resolvedIssues / stats.totalIssues) * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={stats.totalIssues > 0
                      ? (stats.resolvedIssues / stats.totalIssues) * 100
                      : 0
                    }
                    className="bg-orange-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">總問題數</p>
                    <p className="text-2xl font-bold">{stats.totalIssues}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">已解決</p>
                    <p className="text-2xl font-bold text-green-600">{stats.resolvedIssues}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 資料庫表統計 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                資料庫表統計
              </CardTitle>
              <CardDescription>各資料表的記錄數量</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">專案</p>
                      <p className="text-2xl font-bold">{stats.totalProjects}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">審計任務</p>
                      <p className="text-2xl font-bold">{stats.totalTasks}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">問題</p>
                      <p className="text-2xl font-bold">{stats.totalIssues}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 儲存管理 */}
        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                儲存空間使用情況
              </CardTitle>
              <CardDescription>
                瀏覽器 IndexedDB 儲存空間的使用詳情
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {storageDetails ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>已使用空間</span>
                      <span className="font-medium">{storageDetails.percentage}%</span>
                    </div>
                    <Progress value={storageDetails.percentage} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{stats.storageUsed} 已使用</span>
                      <span>{stats.storageQuota} 總配額</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">已使用</p>
                      <p className="text-xl font-bold">{stats.storageUsed}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">總配額</p>
                      <p className="text-xl font-bold">{stats.storageQuota}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">剩餘空間</p>
                      <p className="text-xl font-bold">
                        {((storageDetails.quota - storageDetails.usage) / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  {storageDetails.percentage > 80 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        儲存空間使用率已超過 80%，建議清理不需要的資料或匯出備份後清空資料庫。
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    無法獲取儲存空間資訊。您的瀏覽器可能不支援 Storage API。
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>儲存最佳化建議</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">定期匯出備份</p>
                  <p className="text-sm text-muted-foreground">
                    建議定期匯出資料為 JSON 檔案，防止資料丟失
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">清理舊資料</p>
                  <p className="text-sm text-muted-foreground">
                    刪除不再需要的專案和任務可以釋放儲存空間
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">監控儲存使用</p>
                  <p className="text-sm text-muted-foreground">
                    定期檢查儲存使用情況，避免超出瀏覽器限制
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 資料操作 */}
        <TabsContent value="operations" className="space-y-6">
          <DatabaseManager />
        </TabsContent>

        {/* 設定 */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>資料庫設定</CardTitle>
              <CardDescription>配置資料庫行為和效能選項</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>當前資料庫模式：</strong> {dbMode === 'local' ? '本地 IndexedDB' : dbMode === 'supabase' ? 'Supabase 雲端' : '演示模式'}
                </AlertDescription>
              </Alert>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">自動備份</p>
                    <p className="text-sm text-muted-foreground">
                      定期自動匯出資料備份（開發中）
                    </p>
                  </div>
                  <Badge variant="outline">即將推出</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">資料壓縮</p>
                    <p className="text-sm text-muted-foreground">
                      壓縮儲存資料以節省空間（開發中）
                    </p>
                  </div>
                  <Badge variant="outline">即將推出</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">資料同步</p>
                    <p className="text-sm text-muted-foreground">
                      在多個裝置間同步資料（開發中）
                    </p>
                  </div>
                  <Badge variant="outline">即將推出</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>關於本地資料庫</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                本地資料庫使用瀏覽器的 IndexedDB 技術儲存資料，具有以下特點：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>資料完全儲存在本地，不會上傳到伺服器</li>
                <li>支援離線訪問，無需網路連線</li>
                <li>儲存容量取決於瀏覽器和裝置</li>
                <li>清除瀏覽器資料會刪除所有本地資料</li>
                <li>不同瀏覽器的資料相互獨立</li>
              </ul>
              <p className="pt-2">
                <strong>建議：</strong>定期匯出資料備份，以防意外資料丟失。
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
