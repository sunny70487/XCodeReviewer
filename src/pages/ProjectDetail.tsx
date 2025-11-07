import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Edit, 
  ExternalLink,
  Code,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  FileText
} from "lucide-react";
import { api } from "@/shared/config/database";
import { runRepositoryAudit, scanZipFile } from "@/features/projects/services";
import type { Project, AuditTask, CreateProjectForm } from "@/shared/types";
import { loadZipFile } from "@/shared/utils/zipStorage";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import TerminalProgressDialog from "@/components/audit/TerminalProgressDialog";
import { SUPPORTED_LANGUAGES } from "@/shared/constants";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showTerminalDialog, setShowTerminalDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [editForm, setEditForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });

  // 將小寫語言名轉換為顯示格式
  const formatLanguageName = (lang: string): string => {
    const nameMap: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'go': 'Go',
      'rust': 'Rust',
      'cpp': 'C++',
      'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'swift': 'Swift',
      'kotlin': 'Kotlin'
    };
    return nameMap[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  const supportedLanguages = SUPPORTED_LANGUAGES.map(formatLanguageName);

  useEffect(() => {
    if (id) {
      loadProjectData();
    }
  }, [id]);

  const loadProjectData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [projectData, tasksData] = await Promise.all([
        api.getProjectById(id),
        api.getAuditTasks(id)
      ]);
      
      setProject(projectData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to load project data:', error);
      toast.error("載入專案資料失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAudit = async () => {
    if (!project || !id) return;
    
    // 檢查是否有倉庫地址
    if (project.repository_url) {
      // 有倉庫地址，啟動倉庫審計
      try {
        setScanning(true);
        console.log('開始啟動倉庫審計任務...');
        const taskId = await runRepositoryAudit({
          projectId: id,
          repoUrl: project.repository_url,
          branch: project.default_branch || 'main',
          githubToken: undefined,
          gitlabToken: undefined,
          createdBy: undefined
        });
        
        console.log('審計任務建立成功，taskId:', taskId);
        
        // 顯示終端進度視窗
        setCurrentTaskId(taskId);
        setShowTerminalDialog(true);
        
        // 重新載入專案資料
        loadProjectData();
      } catch (e: any) {
        console.error('啟動審計失敗:', e);
        toast.error(e?.message || '啟動審計失敗');
      } finally {
        setScanning(false);
      }
    } else {
      // 沒有倉庫地址，嘗試從IndexedDB載入儲存的ZIP檔案
      try {
        setScanning(true);
        const file = await loadZipFile(id);
        
        if (file) {
          console.log('找到儲存的ZIP檔案，開始啟動審計...');
          try {
            // 啟動ZIP檔案審計
            const taskId = await scanZipFile({
              projectId: id,
              zipFile: file,
              excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
              createdBy: 'local-user'
            });
            
            console.log('審計任務建立成功，taskId:', taskId);
            
            // 顯示終端進度視窗
            setCurrentTaskId(taskId);
            setShowTerminalDialog(true);
            
            // 重新載入專案資料
            loadProjectData();
          } catch (e: any) {
            console.error('啟動審計失敗:', e);
            toast.error(e?.message || '啟動審計失敗');
          } finally {
            setScanning(false);
          }
        } else {
          setScanning(false);
          toast.warning('此專案未配置倉庫地址，也未上傳ZIP檔案。請先在專案設定中配置倉庫地址，或透過"新建任務"上傳ZIP檔案。');
          // 不自動開啟對話方塊，讓使用者自己選擇
        }
      } catch (error) {
        console.error('啟動審計失敗:', error);
        setScanning(false);
        toast.error('讀取ZIP檔案失敗，請檢查專案配置');
      }
    }
  };

  const handleOpenSettings = () => {
    if (!project) return;
    
    // 初始化編輯表單
    setEditForm({
      name: project.name,
      description: project.description || "",
      repository_url: project.repository_url || "",
      repository_type: project.repository_type || "github",
      default_branch: project.default_branch || "main",
      programming_languages: project.programming_languages ? JSON.parse(project.programming_languages) : []
    });
    
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = async () => {
    if (!id) return;
    
    if (!editForm.name.trim()) {
      toast.error("專案名稱不能為空");
      return;
    }

    try {
      await api.updateProject(id, editForm);
      toast.success("專案資訊已儲存");
      setShowSettingsDialog(false);
      loadProjectData();
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error("儲存失敗");
    }
  };

  const handleToggleLanguage = (lang: string) => {
    const currentLanguages = editForm.programming_languages || [];
    const newLanguages = currentLanguages.includes(lang)
      ? currentLanguages.filter(l => l !== lang)
      : [...currentLanguages, lang];
    
    setEditForm({ ...editForm, programming_languages: newLanguages });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
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

  const handleCreateTask = () => {
    setShowCreateTaskDialog(true);
  };

  const handleTaskCreated = () => {
    toast.success("審計任務已建立", {
      description: '因為網路和程式碼檔案大小等因素，審計時長通常至少需要1分鐘，請耐心等待...',
      duration: 5000
    });
    loadProjectData(); // 重新載入專案資料以顯示新任務
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">專案未找到</h2>
          <p className="text-gray-600 mb-4">請檢查專案ID是否正確</p>
          <Link to="/projects">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回專案列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">
              {project.description || '暫無專案描述'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge variant={project.is_active ? "default" : "secondary"}>
            {project.is_active ? '活躍' : '暫停'}
          </Badge>
          <Button onClick={handleRunAudit} disabled={scanning}>
            <Shield className="w-4 h-4 mr-2" />
            {scanning ? '正在啟動...' : '啟動審計'}
          </Button>
          <Button variant="outline" onClick={handleOpenSettings}>
            <Edit className="w-4 h-4 mr-2" />
            編輯
          </Button>
        </div>
      </div>

      {/* 專案概覽 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">審計任務</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">已完成</p>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">發現問題</p>
                <p className="text-2xl font-bold">
                  {tasks.reduce((sum, task) => sum + task.issues_count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Code className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">平均質量分</p>
                <p className="text-2xl font-bold">
                  {tasks.length > 0 
                    ? (tasks.reduce((sum, task) => sum + task.quality_score, 0) / tasks.length).toFixed(1)
                    : '0.0'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要內容 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">專案概覽</TabsTrigger>
          <TabsTrigger value="tasks">審計任務</TabsTrigger>
          <TabsTrigger value="issues">問題管理</TabsTrigger>
          <TabsTrigger value="settings">專案設定</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 專案資訊 */}
            <Card>
              <CardHeader>
                <CardTitle>專案資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {project.repository_url && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">倉庫地址</span>
                      <a 
                        href={project.repository_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center"
                      >
                        檢視倉庫
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">倉庫型別</span>
                    <Badge variant="outline">
                      {project.repository_type === 'github' ? 'GitHub' : 
                       project.repository_type === 'gitlab' ? 'GitLab' : '其他'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">預設分支</span>
                    <span className="text-sm text-muted-foreground">{project.default_branch}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">建立時間</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">所有者</span>
                    <span className="text-sm text-muted-foreground">
                      {project.owner?.full_name || project.owner?.phone || '未知'}
                    </span>
                  </div>
                </div>

                {/* 程式語言 */}
                {project.programming_languages && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">支援的程式語言</h4>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(project.programming_languages).map((lang: string) => (
                        <Badge key={lang} variant="outline">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 最近活動 */}
            <Card>
              <CardHeader>
                <CardTitle>最近活動</CardTitle>
              </CardHeader>
              <CardContent>
                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(task.status)}
                          <div>
                            <p className="text-sm font-medium">
                              {task.task_type === 'repository' ? '倉庫審計' : '即時分析'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(task.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status === 'completed' ? '已完成' : 
                           task.status === 'running' ? '執行中' : 
                           task.status === 'failed' ? '失敗' : '等待中'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">暫無活動記錄</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">審計任務列表</h3>
            <Button onClick={handleCreateTask}>
              <Play className="w-4 h-4 mr-2" />
              新建任務
            </Button>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <h4 className="font-medium">
                            {task.task_type === 'repository' ? '倉庫審計任務' : '即時分析任務'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            建立於 {formatDate(task.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status === 'completed' ? '已完成' : 
                         task.status === 'running' ? '執行中' : 
                         task.status === 'failed' ? '失敗' : '等待中'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.total_files}</p>
                        <p className="text-sm text-muted-foreground">總檔案數</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.total_lines}</p>
                        <p className="text-sm text-muted-foreground">程式碼行數</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.issues_count}</p>
                        <p className="text-sm text-muted-foreground">發現問題</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.quality_score.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">質量評分</p>
                      </div>
                    </div>

                    {task.status === 'completed' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>質量評分</span>
                          <span>{task.quality_score.toFixed(1)}/100</span>
                        </div>
                        <Progress value={task.quality_score} />
                      </div>
                    )}

                    <div className="flex justify-end space-x-2 mt-4">
                      <Link to={`/tasks/${task.id}`}>
                        <Button variant="outline" size="sm">
                          <FileText className="w-4 h-4 mr-2" />
                          檢視詳情
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">暫無審計任務</h3>
                <p className="text-sm text-muted-foreground mb-4">建立第一個審計任務開始程式碼質量分析</p>
                <Button onClick={handleCreateTask}>
                  <Play className="w-4 h-4 mr-2" />
                  建立任務
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">問題管理</h3>
            <p className="text-sm text-muted-foreground">此功能正在開發中</p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="text-center py-12">
            <Edit className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">專案編輯</h3>
            <p className="text-sm text-muted-foreground">此功能正在開發中</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* 建立任務對話方塊 */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={handleTaskCreated}
        preselectedProjectId={id}
      />

      {/* 終端進度對話方塊 */}
      <TerminalProgressDialog
        open={showTerminalDialog}
        onOpenChange={setShowTerminalDialog}
        taskId={currentTaskId}
        taskType="repository"
      />

      {/* 專案編輯對話方塊 */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯專案</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 基本資訊 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">專案名稱 *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="輸入專案名稱"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">專案描述</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="輸入專案描述"
                  rows={3}
                />
              </div>
            </div>

            {/* 倉庫資訊 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">倉庫資訊</h3>
              
              <div>
                <Label htmlFor="edit-repo-url">倉庫地址</Label>
                <Input
                  id="edit-repo-url"
                  value={editForm.repository_url}
                  onChange={(e) => setEditForm({ ...editForm, repository_url: e.target.value })}
                  placeholder="https://github.com/username/repo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-repo-type">倉庫型別</Label>
                  <Select
                    value={editForm.repository_type}
                    onValueChange={(value: any) => setEditForm({ ...editForm, repository_type: value })}
                  >
                    <SelectTrigger id="edit-repo-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github">GitHub</SelectItem>
                      <SelectItem value="gitlab">GitLab</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-branch">預設分支</Label>
                  <Input
                    id="edit-branch"
                    value={editForm.default_branch}
                    onChange={(e) => setEditForm({ ...editForm, default_branch: e.target.value })}
                    placeholder="main"
                  />
                </div>
              </div>
            </div>

            {/* 程式語言 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">程式語言</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {supportedLanguages.map((lang) => (
                  <div
                    key={lang}
                    className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      editForm.programming_languages?.includes(lang)
                        ? 'border-primary bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleLanguage(lang)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        editForm.programming_languages?.includes(lang)
                          ? 'bg-primary border-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {editForm.programming_languages?.includes(lang) && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{lang}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSettings}>
              儲存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}