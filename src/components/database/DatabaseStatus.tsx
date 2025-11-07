/**
 * 資料庫狀態指示器
 * 顯示當前使用的資料庫模式
 */

import { Database, Cloud, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { dbMode } from '@/shared/config/database';

export function DatabaseStatus() {
  const getStatusConfig = () => {
    switch (dbMode) {
      case 'local':
        return {
          icon: Database,
          label: '本地資料庫',
          variant: 'default' as const,
          description: '資料儲存在瀏覽器本地'
        };
      case 'supabase':
        return {
          icon: Cloud,
          label: 'Supabase 雲端',
          variant: 'secondary' as const,
          description: '資料儲存在雲端'
        };
      case 'demo':
        return {
          icon: Eye,
          label: '演示模式',
          variant: 'outline' as const,
          description: '使用演示資料，不會持久化'
        };
      default:
        return {
          icon: Database,
          label: '未知模式',
          variant: 'destructive' as const,
          description: ''
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function DatabaseStatusDetail() {
  const getStatusConfig = () => {
    switch (dbMode) {
      case 'local':
        return {
          icon: Database,
          label: '本地資料庫模式',
          variant: 'default' as const,
          description: '資料儲存在瀏覽器 IndexedDB 中，完全本地化，隱私安全。',
          tips: '提示：定期匯出資料以防丟失。'
        };
      case 'supabase':
        return {
          icon: Cloud,
          label: 'Supabase 雲端模式',
          variant: 'secondary' as const,
          description: '資料儲存在 Supabase 雲端，支援多裝置同步。',
          tips: '提示：確保網路連線正常。'
        };
      case 'demo':
        return {
          icon: Eye,
          label: '演示模式',
          variant: 'outline' as const,
          description: '使用內建演示資料，所有操作不會持久化儲存。',
          tips: '提示：配置資料庫以儲存您的資料。'
        };
      default:
        return {
          icon: Database,
          label: '未知模式',
          variant: 'destructive' as const,
          description: '資料庫配置異常',
          tips: ''
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <div className="rounded-full bg-muted p-2">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{config.label}</h4>
          <Badge variant={config.variant} className="text-xs">
            {dbMode}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>
        {config.tips && (
          <p className="text-xs text-muted-foreground italic">{config.tips}</p>
        )}
      </div>
    </div>
  );
}
