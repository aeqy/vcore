import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { DEFAULT_HOME_PATH, LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getAccessCodesApi, getUserInfoApi, loginApi, logoutApi } from '#/api';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      // 调用登录API，获取token信息
      const result = await loginApi(params);

      console.log('登录API返回结果:', result);

      // 检查返回结果是否包含access_token
      if (result && typeof result === 'object' && 'access_token' in result) {
        const accessToken = result.access_token;
        const expiresIn = result.expires_in;

        // 如果成功获取到 accessToken
        if (accessToken) {
          // 计算令牌过期时间（当前时间 + expires_in秒）
          const expiresAt = new Date().getTime() + expiresIn * 1000;

          // 存储token和过期时间
          accessStore.setAccessToken(accessToken);
          localStorage.setItem('accessToken', accessToken); // 同时在localStorage中保存，供getUserInfo使用
          localStorage.setItem('token_expires_at', expiresAt.toString());

          // 如果返回了refresh_token，也存储它
          if ('refresh_token' in result && typeof result.refresh_token === 'string') {
            localStorage.setItem('refreshToken', result.refresh_token);
          }

          try {
            // 获取用户信息并存储到 accessStore 中
            const [fetchUserInfoResult, accessCodes] = await Promise.all([
              fetchUserInfo(),
              getAccessCodesApi(),
            ]);

            userInfo = fetchUserInfoResult;

            if (userInfo) {
              userStore.setUserInfo(userInfo);
              accessStore.setAccessCodes(accessCodes);

              // 处理登录成功后的重定向
              if (accessStore.loginExpired) {
                accessStore.setLoginExpired(false);
              } else {
                if (onSuccess) {
                  // 优先使用外部传入的成功回调
                  console.log('使用自定义成功回调处理导航');
                  await onSuccess?.();
                } else {
                  // 使用replace而不是push，避免导航历史问题
                  console.log('使用默认导航到:', userInfo?.homePath || DEFAULT_HOME_PATH);
                  await router.replace({
                    path: userInfo?.homePath || DEFAULT_HOME_PATH
                  });

                  // 强制刷新机制
                  window.setTimeout(() => {
                    // 如果500ms后仍在登录页面，强制跳转
                    if (router.currentRoute.value.path.includes('login')) {
                      console.log('强制跳转到:', userInfo?.homePath || DEFAULT_HOME_PATH);
                      window.location.href = userInfo?.homePath || DEFAULT_HOME_PATH;
                    }
                  }, 500);
                }
              }

              // 显示登录成功提示
              if (userInfo?.realName) {
                notification.success({
                  description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
                  duration: 3,
                  message: $t('authentication.loginSuccess'),
                });
              }
            } else {
              console.error('获取用户信息失败');
              // 即使获取不到用户信息，也可以继续登录流程，使用默认值
              const defaultUserInfo: UserInfo = {
                userId: 'unknown',
                username: params.username || 'admin',
                realName: params.username || 'Admin',
                avatar: '',
                desc: '',
                homePath: '/analytics',
                roles: ['Admin'],
                token: accessToken,
              };

              userStore.setUserInfo(defaultUserInfo);
              userInfo = defaultUserInfo;

              notification.warning({
                message: '用户信息获取受限',
                description: '已使用默认用户信息进行登录，部分功能可能受限',
              });

              // 继续登录流程
              if (accessStore.loginExpired) {
                accessStore.setLoginExpired(false);
              } else {
                if (onSuccess) {
                  await onSuccess();
                } else {
                  // 使用replace而不是push
                  await router.replace({
                    path: DEFAULT_HOME_PATH
                  });
                }
              }
            }
          } catch (userInfoError) {
            console.error('获取用户信息出错:', userInfoError);
            notification.error({
              message: '登录成功但获取用户信息失败',
              description: '您已成功登录，但系统无法获取您的用户信息，部分功能可能受限',
            });

            // 尽管获取用户信息失败，仍可以继续登录流程
            if (onSuccess) {
              await onSuccess();
            } else {
              // 使用replace而不是push
              await router.replace({
                path: DEFAULT_HOME_PATH
              });
            }
          }
        } else {
          // Token为空的处理
          console.error('获取的access_token为空');
          notification.error({
            message: '登录失败',
            description: '无法获取访问令牌',
          });
        }
      } else {
        // 登录响应格式不正确的处理
        console.error('登录返回结果格式不正确:', result);
        notification.error({
          message: '登录失败',
          description: '服务器返回的数据格式不正确',
        });
      }
    } catch (error) {
      // 捕获并处理登录过程中的错误
      console.error('登录过程发生错误:', error);
      notification.error({
        message: '登录失败',
        description: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    }
    resetAllStores();
    accessStore.setLoginExpired(false);

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
