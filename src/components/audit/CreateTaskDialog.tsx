import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  GitBranch, 
  Settings, 
  FileText, 
  AlertCircle, 
  Info,
  Zap,
  Shield,
  Search
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { Project, CreateAuditTaskForm } from "@/shared/types";
import { toast } from "sonner";
import TerminalProgressDialog from "./TerminalProgressDialog";
import { runRepositoryAudit } from "@/features/projects/services/repoScan";
import { scanZipFile, validateZipFile } from "@/features/projects/services/repoZipScan";
import { loadZipFile } from "@/shared/utils/zipStorage";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
  preselectedProjectId?: string;
}

export default function CreateTaskDialog({ open, onOpenChange, onTaskCreated, preselectedProjectId }: CreateTaskDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showTerminalDialog, setShowTerminalDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loadingZipFile, setLoadingZipFile] = useState(false);
  const [hasLoadedZip, setHasLoadedZip] = useState(false);
  
  const [taskForm, setTaskForm] = useState<CreateAuditTaskForm>({
    project_id: "",
    task_type: "repository",
    branch_name: "main",
    exclude_patterns: ["node_modules/**", ".git/**", "dist/**", "build/**", "*.log"],
    scan_config: {
      include_tests: true,
      include_docs: false,
      max_file_size: 1024, // KB
      analysis_depth: "standard"
    }
  });

  const commonExcludePatterns = [
    { label: "node_modules", value: "node_modules/**", description: "Node.js 依賴包" },
    { label: ".git", value: ".git/**", description: "Git 版本控制檔案" },
    { label: "dist/build", value: "dist/**", description: "構建輸出目錄" },
    { label: "logs", value: "*.log", description: "日誌檔案" },
    { label: "cache", value: ".cache/**", description: "快取檔案" },
    { label: "temp", value: "temp/**", description: "臨時檔案" },
    { label: "vendor", value: "vendor/**", description: "第三方庫" },
    { label: "coverage", value: "coverage/**", description: "測試覆蓋率報告" }
  ];

  useEffect(() => {
    if (open) {
      loadProjects();
      // 如果有預選擇的專案ID，設定到表單中
      if (preselectedProjectId) {
        setTaskForm(prev => ({ ...prev, project_id: preselectedProjectId }));
      }
      // 重置ZIP檔案狀態
      setZipFile(null);
      setHasLoadedZip(false);
    }
  }, [open, preselectedProjectId]);

  // 當專案ID變化時，嘗試自動載入儲存的ZIP檔案
  useEffect(() => {
    const autoLoadZipFile = async () => {
      if (!taskForm.project_id || hasLoadedZip) return;
      
      const project = projects.find(p => p.id === taskForm.project_id);
      if (!project || project.repository_type !== 'other') return;
      
      try {
        setLoadingZipFile(true);
        const savedFile = await loadZipFile(taskForm.project_id);
        
        if (savedFile) {
          setZipFile(savedFile);
          setHasLoadedZip(true);
          console.log('✓ 已自動載入儲存的ZIP檔案:', savedFile.name);
          toast.success(`已載入儲存的ZIP檔案: ${savedFile.name}`);
        }
      } catch (error) {
        console.error('自動載入ZIP檔案失敗:', error);
      } finally {
        setLoadingZipFile(false);
      }
    };

    autoLoadZipFile();
  }, [taskForm.project_id, projects, hasLoadedZip]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data.filter(p => p.is_active));
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error("載入專案失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.project_id) {
      toast.error("請選擇專案");
      return;
    }

    if (taskForm.task_type === "repository" && !taskForm.branch_name?.trim()) {
      toast.error("請輸入分支名稱");
      return;
    }

    const project = selectedProject;
    if (!project) {
      toast.error("未找到選中的專案");
      return;
    }

    try {
      setCreating(true);
      
      console.log('🎯 開始建立審計任務...', { 
        projectId: project.id, 
        projectName: project.name,
        repositoryType: project.repository_type 
      });

      let taskId: string;

      // 根據專案是否有repository_url判斷使用哪種掃描方式
      if (!project.repository_url || project.repository_url.trim() === '') {
        // ZIP上傳的專案：需要有ZIP檔案才能掃描
        if (!zipFile) {
          toast.error("請上傳ZIP檔案進行掃描");
          return;
        }
        
        console.log('📦 呼叫 scanZipFile...');
        taskId = await scanZipFile({
          projectId: project.id,
          zipFile: zipFile,
          excludePatterns: taskForm.exclude_patterns,
          createdBy: 'local-user'
        });
      } else {
        // GitHub/GitLab等遠端倉庫
        console.log('📡 呼叫 runRepositoryAudit...');
        
        // 從執行時配置中獲取 Token
        const getRuntimeConfig = () => {
          try {
            const saved = localStorage.getItem('xcodereviewer_runtime_config');
            return saved ? JSON.parse(saved) : null;
          } catch {
            return null;
          }
        };
        const runtimeConfig = getRuntimeConfig();
        const githubToken = runtimeConfig?.githubToken || (import.meta.env.VITE_GITHUB_TOKEN as string | undefined);
        const gitlabToken = runtimeConfig?.gitlabToken || (import.meta.env.VITE_GITLAB_TOKEN as string | undefined);
        
        taskId = await runRepositoryAudit({
          projectId: project.id,
          repoUrl: project.repository_url!,
          branch: taskForm.branch_name || project.default_branch || 'main',
          exclude: taskForm.exclude_patterns,
          githubToken,
          gitlabToken,
          createdBy: 'local-user'
        });
      }
      
      console.log('✅ 任務建立成功:', taskId);
      
      // 記錄使用者操作
      import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
        logger.logUserAction('建立審計任務', {
          taskId,
          projectId: project.id,
          projectName: project.name,
          taskType: taskForm.task_type,
          branch: taskForm.branch_name,
          hasZipFile: !!zipFile,
        });
      });
      
      // 關閉建立對話方塊
      onOpenChange(false);
      resetForm();
      onTaskCreated();
      
      // 顯示終端進度視窗
      setCurrentTaskId(taskId);
      setShowTerminalDialog(true);
      
      toast.success("審計任務已建立並啟動");
    } catch (error) {
      console.error('❌ 建立任務失敗:', error);
      
      // 記錄錯誤並顯示詳細資訊
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '建立審計任務失敗');
      });
      
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      toast.error(`建立任務失敗: ${errorMessage}`);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTaskForm({
      project_id: "",
      task_type: "repository",
      branch_name: "main",
      exclude_patterns: ["node_modules/**", ".git/**", "dist/**", "build/**", "*.log"],
      scan_config: {
        include_tests: true,
        include_docs: false,
        max_file_size: 1024,
        analysis_depth: "standard"
      }
    });
    setSearchTerm("");
  };

  const toggleExcludePattern = (pattern: string) => {
    const patterns = taskForm.exclude_patterns || [];
    if (patterns.includes(pattern)) {
      setTaskForm({
        ...taskForm,
        exclude_patterns: patterns.filter(p => p !== pattern)
      });
    } else {
      setTaskForm({
        ...taskForm,
        exclude_patterns: [...patterns, pattern]
      });
    }
  };

  const addCustomPattern = (pattern: string) => {
    if (pattern.trim() && !taskForm.exclude_patterns.includes(pattern.trim())) {
      setTaskForm({
        ...taskForm,
        exclude_patterns: [...taskForm.exclude_patterns, pattern.trim()]
      });
    }
  };

  const removeExcludePattern = (pattern: string) => {
    setTaskForm({
      ...taskForm,
      exclude_patterns: taskForm.exclude_patterns.filter(p => p !== pattern)
    });
  };

  const selectedProject = projects.find(p => p.id === taskForm.project_id);
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-primary" />
            <span>新建審計任務</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 專案選擇 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">選擇專案</Label>
              <Badge variant="outline" className="text-xs">
                {filteredProjects.length} 個可用專案
              </Badge>
            </div>

            {/* 專案搜尋 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜尋專案名稱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* 專案列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {loading ? (
                <div className="col-span-2 flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <Card 
                    key={project.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      taskForm.project_id === project.id 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setTaskForm({ ...taskForm, project_id: project.id })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{project.name}</h4>
                          {project.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                            <span>{project.repository_type?.toUpperCase() || 'OTHER'}</span>
                            <span>{project.default_branch}</span>
                          </div>
                        </div>
                        {taskForm.project_id === project.id && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchTerm ? '未找到匹配的專案' : '暫無可用專案'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 任務配置 */}
          {selectedProject && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic" className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4" />
                  <span>基礎配置</span>
                </TabsTrigger>
                <TabsTrigger value="exclude" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>排除規則</span>
                </TabsTrigger>
                <TabsTrigger value="advanced" className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>高階選項</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-6">
                {/* ZIP專案檔案上傳 */}
                {(!selectedProject.repository_url || selectedProject.repository_url.trim() === '') && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {loadingZipFile ? (
                          <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            <p className="text-sm text-blue-800">正在載入儲存的ZIP檔案...</p>
                          </div>
                        ) : zipFile ? (
                          <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <Info className="w-5 h-5 text-green-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-green-900 text-sm">已準備就緒</p>
                              <p className="text-xs text-green-700 mt-1">
                                使用儲存的ZIP檔案: {zipFile.name} (
                                {zipFile.size >= 1024 * 1024 
                                  ? `${(zipFile.size / 1024 / 1024).toFixed(2)} MB`
                                  : zipFile.size >= 1024
                                  ? `${(zipFile.size / 1024).toFixed(2)} KB`
                                  : `${zipFile.size} B`
                                })
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setZipFile(null);
                                setHasLoadedZip(false);
                              }}
                            >
                              更換檔案
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start space-x-3">
                              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                              <div>
                                <p className="font-medium text-amber-900 text-sm">需要上傳ZIP檔案</p>
                                <p className="text-xs text-amber-700 mt-1">
                                  未找到儲存的ZIP檔案，請上傳檔案進行掃描
                                </p>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="zipFile">上傳ZIP檔案</Label>
                              <Input
                                id="zipFile"
                                type="file"
                                accept=".zip"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    console.log('📁 選擇的檔案:', {
                                      name: file.name,
                                      size: file.size,
                                      type: file.type,
                                      sizeMB: (file.size / 1024 / 1024).toFixed(2)
                                    });
                                    
                                    const validation = validateZipFile(file);
                                    if (!validation.valid) {
                                      toast.error(validation.error || "檔案無效");
                                      e.target.value = '';
                                      return;
                                    }
                                    setZipFile(file);
                                    setHasLoadedZip(true);
                                    
                                    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                                    const sizeKB = (file.size / 1024).toFixed(2);
                                    const sizeText = file.size >= 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
                                    
                                    toast.success(`已選擇檔案: ${file.name} (${sizeText})`);
                                  }
                                }}
                                className="cursor-pointer"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task_type">任務型別</Label>
                    <Select 
                      value={taskForm.task_type} 
                      onValueChange={(value: any) => setTaskForm({ ...taskForm, task_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="repository">
                          <div className="flex items-center space-x-2">
                            <GitBranch className="w-4 h-4" />
                            <span>倉庫審計</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="instant">
                          <div className="flex items-center space-x-2">
                            <Zap className="w-4 h-4" />
                            <span>即時分析</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {taskForm.task_type === "repository" && (selectedProject.repository_url) && (
                    <div className="space-y-2">
                      <Label htmlFor="branch_name">目標分支</Label>
                      <Input
                        id="branch_name"
                        value={taskForm.branch_name || ""}
                        onChange={(e) => setTaskForm({ ...taskForm, branch_name: e.target.value })}
                        placeholder={selectedProject.default_branch || "main"}
                      />
                    </div>
                  )}
                </div>

                {/* 專案資訊展示 */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 mb-1">選中專案：{selectedProject.name}</p>
                        <div className="text-blue-700 space-y-1">
                          {selectedProject.description && (
                            <p>描述：{selectedProject.description}</p>
                          )}
                          <p>預設分支：{selectedProject.default_branch}</p>
                          {selectedProject.programming_languages && (
                            <p>程式語言：{JSON.parse(selectedProject.programming_languages).join(', ')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="exclude" className="space-y-4 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">排除模式</Label>
                    <p className="text-sm text-gray-500 mt-1">
                      選擇要從審計中排除的檔案和目錄模式
                    </p>
                  </div>

                  {/* 常用排除模式 */}
                  <div className="grid grid-cols-2 gap-3">
                    {commonExcludePatterns.map((pattern) => (
                      <div key={pattern.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                        <Checkbox
                          checked={taskForm.exclude_patterns.includes(pattern.value)}
                          onCheckedChange={() => toggleExcludePattern(pattern.value)}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{pattern.label}</p>
                          <p className="text-xs text-gray-500">{pattern.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 自定義排除模式 */}
                  <div className="space-y-2">
                    <Label>自定義排除模式</Label>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="例如: *.tmp, test/**"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addCustomPattern(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          addCustomPattern(input.value);
                          input.value = '';
                        }}
                      >
                        新增
                      </Button>
                    </div>
                  </div>

                  {/* 已選擇的排除模式 */}
                  {taskForm.exclude_patterns.length > 0 && (
                    <div className="space-y-2">
                      <Label>已選擇的排除模式</Label>
                      <div className="flex flex-wrap gap-2">
                        {taskForm.exclude_patterns.map((pattern) => (
                          <Badge 
                            key={pattern} 
                            variant="secondary" 
                            className="cursor-pointer hover:bg-red-100 hover:text-red-800"
                            onClick={() => removeExcludePattern(pattern)}
                          >
                            {pattern} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-6">
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-medium">掃描配置</Label>
                    <p className="text-sm text-gray-500 mt-1">
                      配置程式碼掃描的詳細引數
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={taskForm.scan_config.include_tests}
                          onCheckedChange={(checked) => 
                            setTaskForm({
                              ...taskForm,
                              scan_config: { ...taskForm.scan_config, include_tests: !!checked }
                            })
                          }
                        />
                        <div>
                          <p className="text-sm font-medium">包含測試檔案</p>
                          <p className="text-xs text-gray-500">掃描 *test*, *spec* 等測試檔案</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={taskForm.scan_config.include_docs}
                          onCheckedChange={(checked) => 
                            setTaskForm({
                              ...taskForm,
                              scan_config: { ...taskForm.scan_config, include_docs: !!checked }
                            })
                          }
                        />
                        <div>
                          <p className="text-sm font-medium">包含文件檔案</p>
                          <p className="text-xs text-gray-500">掃描 README, docs 等文件檔案</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="max_file_size">最大檔案大小 (KB)</Label>
                        <Input
                          id="max_file_size"
                          type="number"
                          value={taskForm.scan_config.max_file_size}
                          onChange={(e) => 
                            setTaskForm({
                              ...taskForm,
                              scan_config: { 
                                ...taskForm.scan_config, 
                                max_file_size: parseInt(e.target.value) || 1024 
                              }
                            })
                          }
                          min="1"
                          max="10240"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="analysis_depth">分析深度</Label>
                        <Select 
                          value={taskForm.scan_config.analysis_depth} 
                          onValueChange={(value: any) => 
                            setTaskForm({
                              ...taskForm,
                              scan_config: { ...taskForm.scan_config, analysis_depth: value }
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">基礎掃描</SelectItem>
                            <SelectItem value="standard">標準掃描</SelectItem>
                            <SelectItem value="deep">深度掃描</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* 分析深度說明 */}
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-900 mb-2">分析深度說明：</p>
                          <ul className="text-amber-800 space-y-1 text-xs">
                            <li>• <strong>基礎掃描</strong>：快速檢查語法錯誤和基本問題</li>
                            <li>• <strong>標準掃描</strong>：包含程式碼質量、安全性和效能分析</li>
                            <li>• <strong>深度掃描</strong>：全面分析，包含複雜度、可維護性等高階指標</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* 操作按鈕 */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              取消
            </Button>
            <Button 
              onClick={handleCreateTask} 
              disabled={!taskForm.project_id || creating}
              className="btn-primary"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  建立中...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  建立任務
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* 終端進度對話方塊 */}
      <TerminalProgressDialog
        open={showTerminalDialog}
        onOpenChange={setShowTerminalDialog}
        taskId={currentTaskId}
        taskType="repository"
      />
    </Dialog>
  );
}