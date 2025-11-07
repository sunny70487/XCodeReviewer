// 路徑別名工具函式
export const paths = {
  // 應用核心
  app: '@/app',
  
  // 元件
  components: '@/components',
  ui: '@/components/ui',
  layout: '@/components/layout',
  features: '@/components/features',
  common: '@/components/common',
  
  // 頁面
  pages: '@/pages',
  
  // 功能模組
  analysisFeature: '@/features/analysis',
  projectsFeature: '@/features/projects',
  auditFeature: '@/features/audit',
  
  // 共享資源
  shared: '@/shared',
  hooks: '@/shared/hooks',
  services: '@/shared/services',
  types: '@/shared/types',
  utils: '@/shared/utils',
  constants: '@/shared/constants',
  config: '@/shared/config',
  
  // 靜態資源
  assets: '@/assets',
  images: '@/assets/images',
  icons: '@/assets/icons',
  styles: '@/assets/styles',
} as const;

// 獲取路徑的輔助函式
export function getPath(key: keyof typeof paths): string {
  return paths[key];
}