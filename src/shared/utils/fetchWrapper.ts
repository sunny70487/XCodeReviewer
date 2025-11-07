/**
 * Fetch包裝器 - 只記錄失敗的API呼叫
 */

import { logger, LogCategory } from './logger';

const originalFetch = window.fetch;

/**
 * 判斷是否應該記錄該URL
 */
function shouldLogUrl(url: string): boolean {
  // 過濾掉靜態資源和某些不需要記錄的請求
  const skipPatterns = [
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i,
    /\/assets\//,
    /chrome-extension:/,
    /localhost:.*\/node_modules/,
  ];
  
  return !skipPatterns.some(pattern => pattern.test(url));
}

/**
 * 包裝fetch - 只記錄錯誤
 */
window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
  const [url, options] = args;
  const method = options?.method || 'GET';
  const urlString = typeof url === 'string' ? url : url.toString();
  
  // 跳過不需要記錄的URL
  if (!shouldLogUrl(urlString)) {
    return originalFetch(...args);
  }

  const startTime = Date.now();

  try {
    const response = await originalFetch(...args);
    const duration = Date.now() - startTime;

    // 只記錄失敗的請求
    if (!response.ok) {
      logger.error(
        LogCategory.API_CALL,
        `API請求失敗: ${method} ${urlString} (${response.status})`,
        { method, url: urlString, status: response.status, statusText: response.statusText, duration }
      );
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    // 記錄網路錯誤
    logger.error(
      LogCategory.API_CALL,
      `API請求異常: ${method} ${urlString}`,
      {
        method,
        url: urlString,
        duration,
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error.stack : undefined
    );

    throw error;
  }
};

export { originalFetch };
