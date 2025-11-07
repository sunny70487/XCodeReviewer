/**
 * 錯誤處理模組
 * 提供統一的錯誤處理和使用者反饋機制
 */

import { toast } from 'sonner';
import { logger, LogCategory } from './logger';

export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: any;
  code?: string | number;
  details?: any;
  timestamp: number;
}

class ErrorHandler {
  /**
   * 處理錯誤並顯示使用者友好的提示
   */
  handle(error: any, context?: string): AppError {
    const appError = this.parseError(error);
    
    // 記錄錯誤日誌
    logger.error(
      LogCategory.SYSTEM,
      `${context ? `[${context}] ` : ''}${appError.message}`,
      {
        type: appError.type,
        code: appError.code,
        details: appError.details,
        originalError: error,
      },
      error?.stack
    );

    // 顯示使用者提示
    this.showErrorToast(appError, context);

    return appError;
  }

  /**
   * 解析錯誤物件
   */
  private parseError(error: any): AppError {
    const timestamp = Date.now();

    // Axios錯誤
    if (error?.isAxiosError || error?.response) {
      return this.parseAxiosError(error, timestamp);
    }

    // Fetch錯誤
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        message: '網路連線失敗，請檢查網路設定',
        originalError: error,
        timestamp,
      };
    }

    // 自定義AppError
    if (error?.type && Object.values(ErrorType).includes(error.type)) {
      return { ...error, timestamp };
    }

    // 標準Error物件
    if (error instanceof Error) {
      return {
        type: ErrorType.UNKNOWN,
        message: error.message || '發生未知錯誤',
        originalError: error,
        timestamp,
      };
    }

    // 其他型別
    return {
      type: ErrorType.UNKNOWN,
      message: typeof error === 'string' ? error : '發生未知錯誤',
      originalError: error,
      timestamp,
    };
  }

  /**
   * 解析Axios錯誤
   */
  private parseAxiosError(error: any, timestamp: number): AppError {
    const response = error.response;
    const status = response?.status;

    // 網路錯誤
    if (!response) {
      return {
        type: ErrorType.NETWORK,
        message: '網路請求失敗，請檢查網路連線',
        originalError: error,
        timestamp,
      };
    }

    // 根據狀態碼分類
    switch (status) {
      case 400:
        return {
          type: ErrorType.VALIDATION,
          message: response.data?.message || '請求引數錯誤',
          code: status,
          details: response.data,
          originalError: error,
          timestamp,
        };

      case 401:
        return {
          type: ErrorType.AUTHENTICATION,
          message: '未登入或登入已過期，請重新登入',
          code: status,
          originalError: error,
          timestamp,
        };

      case 403:
        return {
          type: ErrorType.AUTHORIZATION,
          message: '沒有許可權執行此操作',
          code: status,
          originalError: error,
          timestamp,
        };

      case 404:
        return {
          type: ErrorType.NOT_FOUND,
          message: '請求的資源不存在',
          code: status,
          originalError: error,
          timestamp,
        };

      case 408:
      case 504:
        return {
          type: ErrorType.TIMEOUT,
          message: '請求超時，請稍後重試',
          code: status,
          originalError: error,
          timestamp,
        };

      case 500:
      case 502:
      case 503:
        return {
          type: ErrorType.API,
          message: '伺服器錯誤，請稍後重試',
          code: status,
          details: response.data,
          originalError: error,
          timestamp,
        };

      default:
        return {
          type: ErrorType.API,
          message: response.data?.message || `請求失敗 (${status})`,
          code: status,
          details: response.data,
          originalError: error,
          timestamp,
        };
    }
  }

  /**
   * 顯示錯誤提示
   */
  private showErrorToast(error: AppError, context?: string) {
    const title = context || this.getErrorTitle(error.type);
    
    toast.error(title, {
      description: error.message,
      duration: 5000,
      action: error.code ? {
        label: '檢視詳情',
        onClick: () => this.showErrorDetails(error),
      } : undefined,
    });
  }

  /**
   * 獲取錯誤標題
   */
  private getErrorTitle(type: ErrorType): string {
    const titles = {
      [ErrorType.NETWORK]: '網路錯誤',
      [ErrorType.API]: 'API錯誤',
      [ErrorType.VALIDATION]: '驗證錯誤',
      [ErrorType.AUTHENTICATION]: '認證錯誤',
      [ErrorType.AUTHORIZATION]: '許可權錯誤',
      [ErrorType.NOT_FOUND]: '資源不存在',
      [ErrorType.TIMEOUT]: '請求超時',
      [ErrorType.UNKNOWN]: '未知錯誤',
    };
    return titles[type];
  }

  /**
   * 顯示錯誤詳情
   */
  private showErrorDetails(error: AppError) {
    console.group('錯誤詳情');
    console.log('型別:', error.type);
    console.log('訊息:', error.message);
    console.log('程式碼:', error.code);
    console.log('時間:', new Date(error.timestamp).toLocaleString());
    if (error.details) {
      console.log('詳情:', error.details);
    }
    if (error.originalError) {
      console.log('原始錯誤:', error.originalError);
    }
    console.groupEnd();
  }

  /**
   * 建立錯誤
   */
  createError(type: ErrorType, message: string, details?: any): AppError {
    return {
      type,
      message,
      details,
      timestamp: Date.now(),
    };
  }

  /**
   * 非同步函式錯誤包裝器
   */
  async wrap<T>(
    fn: () => Promise<T>,
    context?: string,
    options?: {
      silent?: boolean;
      fallback?: T;
    }
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      if (!options?.silent) {
        this.handle(error, context);
      } else {
        logger.error(LogCategory.SYSTEM, `${context || 'Error'}: ${error}`, { error });
      }
      return options?.fallback;
    }
  }

  /**
   * 同步函式錯誤包裝器
   */
  wrapSync<T>(
    fn: () => T,
    context?: string,
    options?: {
      silent?: boolean;
      fallback?: T;
    }
  ): T | undefined {
    try {
      return fn();
    } catch (error) {
      if (!options?.silent) {
        this.handle(error, context);
      } else {
        logger.error(LogCategory.SYSTEM, `${context || 'Error'}: ${error}`, { error });
      }
      return options?.fallback;
    }
  }
}

// 匯出單例
export const errorHandler = new ErrorHandler();

// 便捷函式
export const handleError = (error: any, context?: string) => errorHandler.handle(error, context);
export const wrapAsync = <T>(fn: () => Promise<T>, context?: string, options?: any) => 
  errorHandler.wrap(fn, context, options);
export const wrapSync = <T>(fn: () => T, context?: string, options?: any) => 
  errorHandler.wrapSync(fn, context, options);
