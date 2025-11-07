/**
 * 本地資料庫初始化工具
 * 用於在首次使用時建立預設使用者和演示資料
 */

import { localDB } from '../config/localDatabase';
import { api } from '../config/database';

/**
 * 初始化本地資料庫
 * 建立預設使用者和基礎資料
 */
export async function initLocalDatabase(): Promise<void> {
  try {
    // 初始化資料庫
    await localDB.init();
    
    // 檢查是否已有使用者
    const profileCount = await localDB.getProfilesCount();
    
    if (profileCount === 0) {
      // 建立預設本地使用者
      await api.createProfiles({
        id: 'local-user',
        email: 'local@xcodereviewer.com',
        full_name: '本地使用者',
        role: 'admin',
        github_username: 'local-user',
      });
      
      console.log('✅ 本地資料庫初始化成功');
    }
  } catch (error) {
    console.error('❌ 本地資料庫初始化失敗:', error);
    throw error;
  }
}

/**
 * 清空本地資料庫
 * 用於重置或清理資料
 */
export async function clearLocalDatabase(): Promise<void> {
  try {
    const dbName = 'xcodereviewer_local';
    const request = indexedDB.deleteDatabase(dbName);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('✅ 本地資料庫已清空');
        resolve();
      };
      request.onerror = () => {
        console.error('❌ 清空本地資料庫失敗');
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('❌ 清空本地資料庫失敗:', error);
    throw error;
  }
}

/**
 * 匯出本地資料庫資料
 * 用於備份或遷移
 */
export async function exportLocalDatabase(): Promise<string> {
  try {
    await localDB.init();
    
    const data = {
      version: 1,
      exportDate: new Date().toISOString(),
      profiles: await localDB.getAllProfiles(),
      projects: await localDB.getProjects(),
      auditTasks: await localDB.getAuditTasks(),
    };
    
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('❌ 匯出資料失敗:', error);
    throw error;
  }
}

/**
 * 匯入資料到本地資料庫
 * 用於恢復備份或遷移資料
 */
export async function importLocalDatabase(jsonData: string): Promise<void> {
  try {
    const data = JSON.parse(jsonData);
    
    if (!data.version || !data.profiles) {
      throw new Error('無效的資料格式');
    }
    
    await localDB.init();
    
    // 匯入使用者
    for (const profile of data.profiles) {
      await api.createProfiles(profile);
    }
    
    // 匯入專案
    if (data.projects) {
      for (const project of data.projects) {
        await api.createProject(project);
      }
    }
    
    console.log('✅ 資料匯入成功');
  } catch (error) {
    console.error('❌ 匯入資料失敗:', error);
    throw error;
  }
}
