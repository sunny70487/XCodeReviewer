/**
 * 全域性任務控制管理器
 * 用於取消正在執行的審計任務
 */

class TaskControlManager {
  private cancelledTasks: Set<string> = new Set();

  /**
   * 取消任務
   */
  cancelTask(taskId: string) {
    this.cancelledTasks.add(taskId);
    console.log(`🛑 任務 ${taskId} 已標記為取消`);
  }

  /**
   * 檢查任務是否被取消
   */
  isCancelled(taskId: string): boolean {
    return this.cancelledTasks.has(taskId);
  }

  /**
   * 清理已完成任務的控制狀態
   */
  cleanupTask(taskId: string) {
    this.cancelledTasks.delete(taskId);
  }
}

// 匯出單例
export const taskControl = new TaskControlManager();

