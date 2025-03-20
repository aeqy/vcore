import { baseRequestClient  } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
    grant_type?: string;   // OAuth2参数：授权类型，默认"password"
    client_id?: string;    // OAuth2参数：客户端ID，默认"password-client"
    client_secret?: string; // OAuth2参数：客户端密钥，默认"password-client-secret"
    scope?: string;        // OAuth2参数：授权范围，默认"api"
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    access_token: string;  // OAuth2返回的访问令牌
    expires_in: number;    // 令牌过期时间（秒）
    token_type: string;    // 令牌类型，通常为"Bearer"
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 登录
 * 使用OAuth2的password授权模式进行身份验证
 * 需要以application/x-www-form-urlencoded格式发送表单数据
 */
export async function loginApi(data: AuthApi.LoginParams) {
  // 构建表单数据
  const formData = new URLSearchParams();

  // 设置OAuth2必要参数
  formData.append('grant_type', data.grant_type || 'password');
  formData.append('client_id', data.client_id || 'password-client');
  formData.append('client_secret', data.client_secret || 'password-client-secret');
  formData.append('username', data.username || '');
  formData.append('password', data.password || '');
  formData.append('scope', data.scope || 'api');

  // 添加其他可能的自定义参数
  Object.entries(data).forEach(([key, value]) => {
    if (!['username', 'password', 'grant_type', 'client_id', 'client_secret', 'scope'].includes(key) && value !== undefined) {
      formData.append(key, String(value));
    }
  });

  // 直接使用baseRequestClient，不经过requestClient的默认拦截器处理
  // 因为OAuth2 token端点通常有不同的响应结构
  try {
    const response = await baseRequestClient.post<any>('/connect/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('登录成功响应:', response);
    // 返回响应中的数据部分
    return response.data as AuthApi.LoginResult;
  } catch (error) {
    console.error('登录请求失败:', error);
    throw error;
  }
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  const refreshToken = localStorage.getItem('refreshToken') || '';
  const formData = new URLSearchParams();
  formData.append('grant_type', 'refresh_token');
  formData.append('client_id', 'password-client');
  formData.append('client_secret', 'password-client-secret');
  formData.append('refresh_token', refreshToken);

  return baseRequestClient.post<AuthApi.RefreshTokenResult>('/connect/token', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/connect/revoke', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return [];
}
