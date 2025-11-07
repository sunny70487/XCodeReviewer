/**
 * ZIP檔案儲存工具
 * 用於管理儲存在IndexedDB中的ZIP檔案
 */

const DB_NAME = 'xcodereviewer_files';
const STORE_NAME = 'zipFiles';

/**
 * 儲存ZIP檔案到IndexedDB
 */
export async function saveZipFile(projectId: string, file: File): Promise<void> {
  // 檢查瀏覽器是否支援IndexedDB
  if (!window.indexedDB) {
    throw new Error('您的瀏覽器不支援IndexedDB，無法儲存ZIP檔案');
  }

  return new Promise((resolve, reject) => {
    // 不指定版本號，讓IndexedDB使用當前最新版本
    const dbRequest = indexedDB.open(DB_NAME);
    
    dbRequest.onupgradeneeded = (event) => {
      try {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      } catch (error) {
        console.error('建立物件儲存失敗:', error);
        reject(new Error('建立儲存結構失敗，請檢查瀏覽器設定'));
      }
    };

    dbRequest.onsuccess = async (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 檢查物件儲存是否存在，如果不存在則需要升級資料庫
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        // 增加版本號以觸發onupgradeneeded
        const upgradeRequest = indexedDB.open(DB_NAME, db.version + 1);
        
        upgradeRequest.onupgradeneeded = (event) => {
          try {
            const upgradeDb = (event.target as IDBOpenDBRequest).result;
            if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
              upgradeDb.createObjectStore(STORE_NAME);
            }
          } catch (error) {
            console.error('升級資料庫時建立物件儲存失敗:', error);
          }
        };
        
        upgradeRequest.onsuccess = async (event) => {
          const upgradeDb = (event.target as IDBOpenDBRequest).result;
          await performSave(upgradeDb, file, projectId, resolve, reject);
        };
        
        upgradeRequest.onerror = (event) => {
          const error = (event.target as IDBOpenDBRequest).error;
          console.error('升級資料庫失敗:', error);
          reject(new Error(`升級資料庫失敗: ${error?.message || '未知錯誤'}`));
        };
      } else {
        await performSave(db, file, projectId, resolve, reject);
      }
    };

    dbRequest.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      console.error('開啟IndexedDB失敗:', error);
      const errorMsg = error?.message || '未知錯誤';
      reject(new Error(`無法開啟本地儲存，可能是隱私模式或儲存許可權問題: ${errorMsg}`));
    };

    dbRequest.onblocked = () => {
      console.warn('資料庫被阻塞，可能有其他標籤頁正在使用');
      reject(new Error('資料庫被佔用，請關閉其他標籤頁後重試'));
    };
  });
}

async function performSave(
  db: IDBDatabase,
  file: File,
  projectId: string,
  resolve: () => void,
  reject: (error: Error) => void
) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const putRequest = store.put({
      buffer: arrayBuffer,
      fileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString()
    }, projectId);
    
    putRequest.onerror = (event) => {
      const error = (event.target as IDBRequest).error;
      console.error('寫入資料失敗:', error);
      reject(new Error(`儲存ZIP檔案失敗: ${error?.message || '未知錯誤'}`));
    };
    
    transaction.oncomplete = () => {
      console.log(`ZIP檔案已儲存到專案 ${projectId} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      db.close();
      resolve();
    };
    
    transaction.onerror = (event) => {
      const error = (event.target as IDBTransaction).error;
      console.error('事務失敗:', error);
      reject(new Error(`儲存事務失敗: ${error?.message || '未知錯誤'}`));
    };
    
    transaction.onabort = () => {
      console.error('事務被中止');
      reject(new Error('儲存操作被中止'));
    };
  } catch (error) {
    console.error('儲存ZIP檔案時發生異常:', error);
    reject(error as Error);
  }
}

/**
 * 從IndexedDB載入ZIP檔案
 */
export async function loadZipFile(projectId: string): Promise<File | null> {
  return new Promise((resolve, reject) => {
    // 不指定版本號，讓IndexedDB使用當前最新版本
    const dbRequest = indexedDB.open(DB_NAME);
    
    dbRequest.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    dbRequest.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        resolve(null);
        return;
      }
      
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(projectId);
      
      getRequest.onsuccess = () => {
        const savedFile = getRequest.result;
        
        if (savedFile && savedFile.buffer) {
          const blob = new Blob([savedFile.buffer], { type: 'application/zip' });
          const file = new File([blob], savedFile.fileName, { type: 'application/zip' });
          resolve(file);
        } else {
          resolve(null);
        }
      };
      
      getRequest.onerror = () => {
        reject(new Error('讀取ZIP檔案失敗'));
      };
    };

    dbRequest.onerror = () => {
      // 資料庫開啟失敗，可能是首次使用，返回null而不是報錯
      console.warn('開啟ZIP檔案資料庫失敗，可能是首次使用');
      resolve(null);
    };
  });
}

/**
 * 刪除ZIP檔案
 */
export async function deleteZipFile(projectId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 不指定版本號，讓IndexedDB使用當前最新版本
    const dbRequest = indexedDB.open(DB_NAME);
    
    dbRequest.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    dbRequest.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        resolve();
        return;
      }
      
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const deleteRequest = store.delete(projectId);
      
      deleteRequest.onsuccess = () => {
        console.log(`已刪除專案 ${projectId} 的ZIP檔案`);
        resolve();
      };
      
      deleteRequest.onerror = () => {
        reject(new Error('刪除ZIP檔案失敗'));
      };
    };

    dbRequest.onerror = () => {
      // 資料庫開啟失敗，可能檔案不存在，直接resolve
      console.warn('開啟ZIP檔案資料庫失敗，跳過刪除操作');
      resolve();
    };
  });
}

/**
 * 檢查是否存在ZIP檔案
 */
export async function hasZipFile(projectId: string): Promise<boolean> {
  try {
    const file = await loadZipFile(projectId);
    return file !== null;
  } catch {
    return false;
  }
}

