import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Search,
  GitBranch,
  Calendar,
  Users,
  Settings,
  ExternalLink,
  Code,
  Shield,
  Activity,
  Upload,
  FileText,
  AlertCircle,
  Trash2,
  Edit,
  CheckCircle
} from "lucide-react";
import { api } from "@/shared/config/database";
import { validateZipFile } from "@/features/projects/services";
import type { Project, CreateProjectForm } from "@/shared/types";
import { saveZipFile } from "@/shared/utils/zipStorage";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import { SUPPORTED_LANGUAGES } from "@/shared/constants";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [selectedProjectForTask, setSelectedProjectForTask] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });
  const [createForm, setCreateForm] = useState<CreateProjectForm>({
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
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error("載入專案失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!createForm.name.trim()) {
      toast.error("請輸入專案名稱");
      return;
    }

    try {
      await api.createProject({
        ...createForm,
        // 無登入場景下不傳 owner_id，由後端置為 null
      } as any);

      // 記錄使用者操作
      import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
        logger.logUserAction('建立專案', {
          projectName: createForm.name,
          repositoryType: createForm.repository_type,
          languages: createForm.programming_languages,
        });
      });

      toast.success("專案建立成功");
      setShowCreateDialog(false);
      resetCreateForm();
      loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
      
      // 記錄錯誤並顯示詳細資訊
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '建立專案失敗');
      });
      
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      toast.error(`建立專案失敗: ${errorMessage}`);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      description: "",
      repository_url: "",
      repository_type: "github",
      default_branch: "main",
      programming_languages: []
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 驗證檔案
    const validation = validateZipFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // 檢查是否有專案名稱
    if (!createForm.name.trim()) {
      toast.error("請先輸入專案名稱");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // 模擬上傳進度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 20;
        });
      }, 100);

      // 建立專案
      const project = await api.createProject({
        ...createForm,
        repository_type: "other"
      } as any);

      // 儲存ZIP檔案到IndexedDB（使用專案ID作為key）
      try {
        await saveZipFile(project.id, file);
      } catch (error) {
        console.error('儲存ZIP檔案失敗:', error);
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

      // 記錄使用者操作
      import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
        logger.logUserAction('上傳ZIP檔案建立專案', {
          projectName: project.name,
          fileName: file.name,
          fileSize: file.size,
        });
      });

      // 關閉建立對話方塊
      setShowCreateDialog(false);
      resetCreateForm();
      loadProjects();

      toast.success(`專案 "${project.name}" 已建立`, {
        description: 'ZIP檔案已儲存，您可以啟動程式碼審計',
        duration: 4000
      });

    } catch (error: any) {
      console.error('Upload failed:', error);
      
      // 記錄錯誤並顯示詳細資訊
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '上傳ZIP檔案失敗');
      });
      
      const errorMessage = error?.message || '未知錯誤';
      toast.error(`上傳失敗: ${errorMessage}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRepositoryIcon = (type?: string) => {
    switch (type) {
      case 'github': return '🐙';
      case 'gitlab': return '🦊';
      default: return '📁';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const handleCreateTask = (projectId: string) => {
    setSelectedProjectForTask(projectId);
    setShowCreateTaskDialog(true);
  };

  const handleEditClick = (project: Project) => {
    setProjectToEdit(project);
    setEditForm({
      name: project.name,
      description: project.description || "",
      repository_url: project.repository_url || "",
      repository_type: project.repository_type || "github",
      default_branch: project.default_branch || "main",
      programming_languages: project.programming_languages ? JSON.parse(project.programming_languages) : []
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!projectToEdit) return;

    if (!editForm.name.trim()) {
      toast.error("專案名稱不能為空");
      return;
    }

    try {
      await api.updateProject(projectToEdit.id, editForm);
      toast.success(`專案 "${editForm.name}" 已更新`);
      setShowEditDialog(false);
      setProjectToEdit(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error("更新專案失敗");
    }
  };

  const handleToggleLanguage = (lang: string) => {
    const currentLanguages = editForm.programming_languages || [];
    const newLanguages = currentLanguages.includes(lang)
      ? currentLanguages.filter(l => l !== lang)
      : [...currentLanguages, lang];
    
    setEditForm({ ...editForm, programming_languages: newLanguages });
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      await api.deleteProject(projectToDelete.id);
      
      // 記錄使用者操作
      import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
        logger.logUserAction('刪除專案', {
          projectId: projectToDelete.id,
          projectName: projectToDelete.name,
        });
      });
      
      toast.success(`專案 "${projectToDelete.name}" 已移到回收站`, {
        description: '您可以在回收站中恢復此專案',
        duration: 4000
      });
      setShowDeleteDialog(false);
      setProjectToDelete(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
      
      // 記錄錯誤並顯示詳細資訊
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '刪除專案失敗');
      });
      
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      toast.error(`刪除專案失敗: ${errorMessage}`);
    }
  };

  const handleTaskCreated = () => {
    toast.success("審計任務已建立", {
      description: '因為網路和程式碼檔案大小等因素，審計時長通常至少需要1分鐘，請耐心等待...',
      duration: 5000
    });
    // 任務建立後會自動跳轉到專案詳情頁面
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 頁面標題和操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">專案管理</h1>
          <p className="page-subtitle">管理您的程式碼專案，配置審計規則和檢視分析結果</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新建專案
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>建立新專案</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="repository" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="repository">Git 倉庫</TabsTrigger>
                <TabsTrigger value="upload">上傳程式碼</TabsTrigger>
              </TabsList>

              <TabsContent value="repository" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">專案名稱 *</Label>
                    <Input
                      id="name"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="輸入專案名稱"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repository_type">倉庫型別</Label>
                    <Select
                      value={createForm.repository_type}
                      onValueChange={(value: any) => setCreateForm({ ...createForm, repository_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github">GitHub</SelectItem>
                        <SelectItem value="gitlab">GitLab</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">專案描述</Label>
                  <Textarea
                    id="description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="簡要描述專案內容和目標"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="repository_url">倉庫地址</Label>
                    <Input
                      id="repository_url"
                      value={createForm.repository_url}
                      onChange={(e) => setCreateForm({ ...createForm, repository_url: e.target.value })}
                      placeholder="https://github.com/user/repo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_branch">預設分支</Label>
                    <Input
                      id="default_branch"
                      value={createForm.default_branch}
                      onChange={(e) => setCreateForm({ ...createForm, default_branch: e.target.value })}
                      placeholder="main"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>程式語言</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {supportedLanguages.map((lang) => (
                      <label key={lang} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={createForm.programming_languages.includes(lang)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({
                                ...createForm,
                                programming_languages: [...createForm.programming_languages, lang]
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                programming_languages: createForm.programming_languages.filter(l => l !== lang)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{lang}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreateProject}>
                    建立專案
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="upload-name">專案名稱 *</Label>
                  <Input
                    id="upload-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="輸入專案名稱"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upload-description">專案描述</Label>
                  <Textarea
                    id="upload-description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="簡要描述專案內容和目標"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>程式語言</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {supportedLanguages.map((lang) => (
                      <label key={lang} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={createForm.programming_languages.includes(lang)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({
                                ...createForm,
                                programming_languages: [...createForm.programming_languages, lang]
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                programming_languages: createForm.programming_languages.filter(l => l !== lang)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{lang}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 檔案上傳區域 */}
                <div className="space-y-4">
                  <Label>上傳程式碼檔案</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">上傳 ZIP 檔案</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      支援 ZIP 格式，最大 100MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || !createForm.name.trim()}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      選擇檔案
                    </Button>
                  </div>

                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>上傳並分析中...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                      <div className="text-sm text-red-800">
                        <p className="font-medium mb-1">上傳說明：</p>
                        <ul className="space-y-1 text-xs">
                          <li>• 請確保 ZIP 檔案包含完整的專案程式碼</li>
                          <li>• 系統會自動排除 node_modules、.git 等目錄</li>
                          <li>• ZIP 檔案會儲存，只需上傳一次</li>
                          <li>• 建立後可在專案詳情頁啟動多次審計</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={uploading}>
                    取消
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜尋和篩選 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜尋專案名稱或描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              篩選
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 專案列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <Card key={project.id} className="card-modern group">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-lg">
                      {getRepositoryIcon(project.repository_type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        <Link to={`/projects/${project.id}`}>
                          {project.name}
                        </Link>
                      </CardTitle>
                      {project.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={project.is_active ? "default" : "secondary"} className="flex-shrink-0">
                    {project.is_active ? '活躍' : '暫停'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* 專案資訊 */}
                <div className="space-y-3">
                  {project.repository_url && (
                    <div className="flex items-center text-sm text-gray-500">
                      <GitBranch className="w-4 h-4 mr-2 flex-shrink-0" />
                      <a
                        href={project.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors flex items-center truncate"
                      >
                        <span className="truncate">{project.repository_url.replace('https://', '')}</span>
                        <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(project.created_at)}
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      {project.owner?.full_name || '未知'}
                    </div>
                  </div>
                </div>

                {/* 程式語言 */}
                {project.programming_languages && (
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(project.programming_languages).slice(0, 4).map((lang: string) => (
                      <Badge key={lang} variant="outline" className="text-xs">
                        {lang}
                      </Badge>
                    ))}
                    {JSON.parse(project.programming_languages).length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{JSON.parse(project.programming_languages).length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                {/* 快速操作 */}
                <div className="flex gap-2 pt-2">
                  <Link to={`/projects/${project.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full btn-secondary">
                      <Code className="w-4 h-4 mr-2" />
                      檢視詳情
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    className="btn-primary"
                    onClick={() => handleCreateTask(project.id)}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    新建任務
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => handleEditClick(project)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteClick(project)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card className="card-modern">
              <CardContent className="empty-state py-16">
                <div className="empty-icon">
                  <Code className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? '未找到匹配的專案' : '暫無專案'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md">
                  {searchTerm ? '嘗試調整搜尋條件' : '建立您的第一個專案開始程式碼審計'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowCreateDialog(true)} className="btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    建立專案
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 專案統計 */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">總專案數</p>
                  <p className="stat-value text-xl">{projects.length}</p>
                </div>
                <div className="stat-icon from-primary to-accent">
                  <Code className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">活躍專案</p>
                  <p className="stat-value text-xl">{projects.filter(p => p.is_active).length}</p>
                </div>
                <div className="stat-icon from-emerald-500 to-emerald-600">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">GitHub</p>
                  <p className="stat-value text-xl">{projects.filter(p => p.repository_type === 'github').length}</p>
                </div>
                <div className="stat-icon from-purple-500 to-purple-600">
                  <GitBranch className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">GitLab</p>
                  <p className="stat-value text-xl">{projects.filter(p => p.repository_type === 'gitlab').length}</p>
                </div>
                <div className="stat-icon from-orange-500 to-orange-600">
                  <Shield className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 建立任務對話方塊 */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={handleTaskCreated}
        preselectedProjectId={selectedProjectForTask}
      />

      {/* 編輯專案對話方塊 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit}>
              儲存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話方塊 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移到回收站</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要刪除專案 <span className="font-semibold text-gray-900">"{projectToDelete?.name}"</span> 嗎？
              <br />
              <br />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
                <p className="text-blue-800 font-semibold mb-2">💡 溫馨提示</p>
                <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
                  <li>專案將被移到<span className="font-semibold">回收站</span>，不會立即刪除</li>
                  <li>您可以在回收站中隨時恢復此專案</li>
                  <li>相關的審計任務和報告將會保留</li>
                  <li>如需永久刪除，請在回收站中操作</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
            >
              移到回收站
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}