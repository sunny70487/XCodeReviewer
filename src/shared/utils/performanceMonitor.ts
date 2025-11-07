/**
 * 效能監控模組
 */

import { logger } from './logger';

class PerformanceMonitor {
  private marks = new Map<string, number>();

  /**
   * 開始計時
   */
  start(label: string) {
    this.marks.set(label, performance.now());
  }

  /**
   * 結束計時並記錄
   */
  end(label: string, logToConsole = false) {
    const startTime = this.marks.get(label);
    if (!startTime) {
      console.warn(`Performance mark "${label}" not found`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(label);

    logger.logPerformance(label, Math.round(duration));

    if (logToConsole) {
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * 測量函式執行時間
   */
  async measure<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    this.start(label);
    try {
      const result = await fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  /**
   * 監控頁面效能指標 - 禁用自動監控
   */
  monitorPagePerformance() {
    // 不自動記錄頁面效能，只在需要時手動呼叫
    return;
  }

  /**
   * 監控資源載入 - 禁用
   */
  monitorResourceLoading() {
    // 不記錄資源載入
    return;
  }

  /**
   * 監控記憶體使用 - 禁用
   */
  monitorMemory() {
    // 不記錄記憶體使用
    return;
  }

  /**
   * 監控長任務 - 禁用
   */
  monitorLongTasks() {
    // 不記錄長任務
    return;
  }

  /**
   * 初始化所有監控
   */
  initAll() {
    this.monitorPagePerformance();
    this.monitorResourceLoading();
    this.monitorMemory();
    this.monitorLongTasks();
  }
}

export const performanceMonitor = new PerformanceMonitor();
