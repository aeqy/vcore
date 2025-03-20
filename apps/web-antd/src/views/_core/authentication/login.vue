<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { BasicOption } from '@vben/types';

import { computed, markRaw, ref, watch, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { AuthenticationLogin, SliderCaptcha, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

// 添加登录错误状态管理
const loginError = ref(false);
const errorMessage = ref('');
const loginForm = ref<Record<string, any>>({
  username: '',
  password: '',
  selectAccount: '',
  captcha: false
});

// 获取重定向URL（如果有）
const redirectUrl = computed(() => {
  return route.query.redirect ? decodeURIComponent(route.query.redirect as string) : '';
});

// 用户模拟账号选项
const MOCK_USER_OPTIONS: BasicOption[] = [
  {
    label: 'Super',
    value: 'vben',
  },
  {
    label: 'Admin',
    value: 'admin',
  },
  {
    label: 'User',
    value: 'jack',
  },
];

// 登录表单schema定义
const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenSelect',
      componentProps: {
        options: MOCK_USER_OPTIONS,
        placeholder: $t('authentication.selectAccount'),
      },
      fieldName: 'selectAccount',
      label: $t('authentication.selectAccount'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.selectAccount') })
        .optional()
        .default('vben'),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      dependencies: {
        trigger(values, form) {
          if (values.selectAccount) {
            const findUser = MOCK_USER_OPTIONS.find(
              (item) => item.value === values.selectAccount,
            );
            if (findUser) {
              form.setValues({
                password: 'Admin@123',
                username: findUser.value,
              });

              // 同步更新本地状态
              loginForm.value.username = findUser.value;
              loginForm.value.password = 'Admin@123';
            }
          }
        },
        triggerFields: ['selectAccount'],
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: markRaw(SliderCaptcha),
      fieldName: 'captcha',
      rules: z.boolean().refine((value) => value, {
        message: $t('authentication.verifyRequiredTip'),
      }),
    },
  ];
});

// 监听表单值变化
const updateFormValue = (field: string, value: any) => {
  loginForm.value[field] = value;
};

// 当账号选择变化时，自动填充表单
watch(() => loginForm.value.selectAccount, (newVal) => {
  if (newVal) {
    const findUser = MOCK_USER_OPTIONS.find(item => item.value === newVal);
    if (findUser) {
      loginForm.value.username = findUser.value;
      loginForm.value.password = 'Admin@123';
    }
  }
});

// 处理登录表单提交
const handleSubmit = async (formData: Record<string, any>) => {
  try {
    // 重置错误状态
    loginError.value = false;
    errorMessage.value = '';

    console.log('提交登录表单:', formData);

    // 添加必要的OAuth2认证参数
    const loginParams = {
      ...formData,
      grant_type: 'password',
      client_id: 'password-client',
      client_secret: 'password-client-secret',
      scope: 'api'
    };

    // 保存登录前的路由路径，用于调试
    const fromPath = router.currentRoute.value.fullPath;
    console.log('登录前路径:', fromPath);

    // 调用登录API，使用自定义回调确保导航正确执行
    const result = await authStore.authLogin(loginParams, async () => {
      // 登录成功回调
      console.log('登录成功，准备跳转...');

      try {
        if (redirectUrl.value) {
          console.log('重定向到:', redirectUrl.value);
          // 使用replace以避免导航历史问题
          await router.replace(redirectUrl.value);
        } else {
          console.log('重定向到默认路径');
          // 没有重定向URL时跳转到默认路径
          await router.replace('/analytics');
        }
        console.log('路由导航完成，当前路径:', router.currentRoute.value.fullPath);

        // 强制刷新当前视图
        window.setTimeout(() => {
          // 如果路径仍然未变化，强制刷新一次
          if (router.currentRoute.value.path.includes('login')) {
            console.log('检测到仍在登录页面，强制刷新...');
            window.location.href = '/dashboard/analysis';
          }
        }, 500);
      } catch (navError) {
        console.error('导航过程出错:', navError);
        // 导航失败时进行备用处理
        window.location.href = '/dashboard/analysis';
      }
    });

    console.log('登录结果:', result);
  } catch (error) {
    console.error('登录提交错误:', error);
    loginError.value = true;
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试';
  }
};

// 监听路由变化
const clearLoginStatus = () => {
  // 清理表单状态
  loginForm.value = {
    username: '',
    password: '',
    selectAccount: '',
    captcha: false
  };
  loginError.value = false;
  errorMessage.value = '';
};

// 在组件销毁前清理状态
onBeforeUnmount(() => {
  clearLoginStatus();
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-register="false"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-third-party-login="false"
    :show-remember-me="false"
    @submit="authStore.authLogin"
  />
</template>
