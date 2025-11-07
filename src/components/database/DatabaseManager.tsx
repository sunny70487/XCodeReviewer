/**
 * 資料庫管理元件
 * 提供本地資料庫的匯出、匯入、清空等功能
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, Trash2, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { dbMode, isLocalMode } from '@/shared/config/database';
import { 
  exportLocalDatabase, 
  importLocalDatabase, 
  clearLocalDatabase,
  initLocalDatabase 
} from '@/shared/utils/initLocalDB';

export function DatabaseManager() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 匯出資料
  const handleExport = async () => {
    try {
      setLoading(true);
      setMessage(null);
      
      const jsonData = await exportLocalDatabase();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xcodereviewer-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: '資料匯出成功！' });
    } catch (error) {
      console.error('匯出失敗:', error);
      setMessage({ type: 'error', text: '資料匯出失敗，請重試' });
    } finally {
      setLoading(false);
    }
  };

  // 匯入資料
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setMessage(null);
      
      const text = await file.text();
      await importLocalDatabase(text);
      
      setMessage({ type: 'success', text: '資料匯入成功！頁面將重新整理...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('匯入失敗:', error);
      setMessage({ type: 'error', text: '資料匯入失敗，請檢查檔案格式' });
    } finally {
      setLoading(false);
    }
  };

  // 清空資料
  const handleClear = async () => {
    if (!confirm('確定要清空所有本地資料嗎？此操作不可恢復！')) {
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      
      await clearLocalDatabase();
      
      setMessage({ type: 'success', text: '資料已清空！頁面將重新整理...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('清空失敗:', error);
      setMessage({ type: 'error', text: '清空資料失敗，請重試' });
    } finally {
      setLoading(false);
    }
  };

  // 初始化資料庫
  const handleInit = async () => {
    try {
      setLoading(true);
      setMessage(null);
      
      await initLocalDatabase();
      
      setMessage({ type: 'success', text: '資料庫初始化成功！' });
    } catch (error) {
      console.error('初始化失敗:', error);
      setMessage({ type: 'error', text: '初始化失敗，請重試' });
    } finally {
      setLoading(false);
    }
  };

  if (!isLocalMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            資料庫管理
          </CardTitle>
          <CardDescription>
            當前使用 {dbMode === 'supabase' ? 'Supabase 雲端' : '演示'} 模式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              資料庫管理功能僅在本地資料庫模式下可用。
              {dbMode === 'demo' && '請在 .env 檔案中配置 VITE_USE_LOCAL_DB=true 啟用本地資料庫。'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          本地資料庫管理
        </CardTitle>
        <CardDescription>
          管理您的本地資料庫，包括匯出、匯入和清空資料
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">匯出資料</h4>
            <p className="text-sm text-muted-foreground">
              將本地資料匯出為 JSON 檔案，用於備份或遷移
            </p>
            <Button
              onClick={handleExport}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              匯出資料
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">匯入資料</h4>
            <p className="text-sm text-muted-foreground">
              從 JSON 檔案恢復資料
            </p>
            <Button
              onClick={() => document.getElementById('import-file')?.click()}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Upload className="mr-2 h-4 w-4" />
              匯入資料
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">初始化資料庫</h4>
            <p className="text-sm text-muted-foreground">
              建立預設使用者和基礎資料
            </p>
            <Button
              onClick={handleInit}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Database className="mr-2 h-4 w-4" />
              初始化
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-destructive">清空資料</h4>
            <p className="text-sm text-muted-foreground">
              刪除所有本地資料（不可恢復）
            </p>
            <Button
              onClick={handleClear}
              disabled={loading}
              className="w-full"
              variant="destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              清空資料
            </Button>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>提示：</strong>本地資料儲存在瀏覽器中，清除瀏覽器資料會導致資料丟失。
            建議定期匯出備份。
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
