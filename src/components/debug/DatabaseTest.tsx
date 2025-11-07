import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  RefreshCw
} from "lucide-react";
import { api } from "@/shared/config/database";
import { toast } from "sonner";

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  duration?: number;
}

export default function DatabaseTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    
    const tests: Array<{ name: string; test: () => Promise<any> }> = [
      {
        name: "資料庫連線測試",
        test: async () => {
          const start = Date.now();
          await api.getProjectStats();
          return { duration: Date.now() - start };
        }
      },
      {
        name: "專案資料查詢",
        test: async () => {
          const start = Date.now();
          const projects = await api.getProjects();
          return { 
            duration: Date.now() - start,
            count: projects.length 
          };
        }
      },
      {
        name: "審計任務查詢",
        test: async () => {
          const start = Date.now();
          const tasks = await api.getAuditTasks();
          return { 
            duration: Date.now() - start,
            count: tasks.length 
          };
        }
      },
      {
        name: "使用者配置查詢",
        test: async () => {
          const start = Date.now();
          const count = await api.getProfilesCount();
          return { 
            duration: Date.now() - start,
            count 
          };
        }
      }
    ];

    for (const { name, test } of tests) {
      try {
        // 新增pending狀態
        setResults(prev => [...prev, { name, status: 'pending', message: '測試中...' }]);
        
        const result = await test();
        
        // 更新為成功狀態
        setResults(prev => prev.map(r => 
          r.name === name 
            ? { 
                name, 
                status: 'success', 
                message: `測試透過 (${result.duration}ms)${result.count !== undefined ? ` - 資料量: ${result.count}` : ''}`,
                duration: result.duration
              }
            : r
        ));
      } catch (error: any) {
        // 更新為錯誤狀態
        setResults(prev => prev.map(r => 
          r.name === name 
            ? { 
                name, 
                status: 'error', 
                message: `測試失敗: ${error.message || '未知錯誤'}`
              }
            : r
        ));
      }
      
      // 新增延遲避免過快執行
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setTesting(false);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = tests.length;
    
    if (successCount === totalCount) {
      toast.success("所有資料庫測試透過！");
    } else {
      toast.error(`${totalCount - successCount} 個測試失敗`);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">透過</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">失敗</Badge>;
      case 'pending':
        return <Badge className="bg-red-50 text-red-800">測試中</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="w-5 h-5 mr-2" />
          資料庫連線測試
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            測試資料庫連線狀態和基本功能
          </p>
          <Button 
            onClick={runTests} 
            disabled={testing}
            size="sm"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                測試中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                開始測試
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <p className="font-medium text-sm">{result.name}</p>
                    <p className="text-xs text-gray-500">{result.message}</p>
                  </div>
                </div>
                {getStatusBadge(result.status)}
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && !testing && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              測試完成！成功: {results.filter(r => r.status === 'success').length} / 
              總計: {results.length}
            </AlertDescription>
          </Alert>
        )}

        {results.length === 0 && !testing && (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              點選"開始測試"按鈕來檢查資料庫連線狀態
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}