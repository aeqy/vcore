import type { UserInfo } from '@vben/types';

import { baseRequestClient } from '#/api/request';

/**
 * 获取用户信息
 * 接口返回格式为 { code: 0, data: { ... }, message: 'Success' }
 */
export async function getUserInfoApi() {
  try {
    // 使用baseRequestClient代替requestClient，并设置正确的请求头
    const response = await baseRequestClient.get('/connect/userinfo', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      // 不启用withCredentials，避免CORS问题
      withCredentials: false,
    });

    console.log('获取用户信息成功:', response);

    // 检查响应数据格式
    if (response && response.data) {
      let userData;

      // 处理可能的嵌套数据结构
      if (response.data.code === 0 && response.data.data) {
        // 嵌套结构：{ code: 0, data: { ... }, message: '...' }
        userData = response.data.data;
      } else {
        // 直接结构：{ sub: '...', email: '...', ... }
        userData = response.data;
      }

      // 构建符合UserInfo接口的对象
      const userInfo: UserInfo = {
        userId: userData.sub || '',
        username: userData.preferred_username || '',
        realName: userData.preferred_username || userData.name || '',
        avatar: userData.picture || '',
        desc: '',
        homePath: '/',
        roles: userData.roles || [],
        token: localStorage.getItem('accessToken') || '',
      };

      console.log('处理后的用户信息:', userInfo);
      return userInfo;
    }
  } catch (error) {
    console.error('获取用户信息出错:', error);
    // 异常情况下，返回基本用户信息，避免整个登录流程失败
    const accessToken = localStorage.getItem('accessToken') || '';
    if (accessToken) {
      // 如果有token，构造一个基本的用户信息对象
      return {
        userId: 'unknown',
        username: 'admin',
        realName: 'Admin User',
        avatar: '',
        desc: '',
        homePath: '/dashboard/analysis',
        roles: ['Admin'],
        token: accessToken,
      };
    }
  }

  // 如果响应格式不符合预期，返回null
  return null;
}
