import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { BackendCalls } from '@/api'
import { useRouter } from 'vue-router'
import { type UserInfo } from '@/api'

interface UserSettings {
  imageDir: string;
  metaDir: string;
  openaiAPIBase: string;
  openaiAPIKey: string;
  openaiModel: string;
  descPrompt: string;
}

export const useUserStore = defineStore('UserInfo', () => {
  const backendUrl = ref("http://localhost:8000");
  const hashkey = ref("");
  const backend = new BackendCalls();
  const user: Ref<UserInfo | null> = ref(null);
  const settings = ref(defaultSettings());

  function defaultSettings(): UserSettings {
    return {
      imageDir: "public/images/",
      metaDir: "public/meta/",
      openaiAPIBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      openaiAPIKey: "",
      openaiModel: "qwen-vl-plus",
      descPrompt: "请以口腔医生/牙科工作者的视角简要描述这张图像的主要内容和拍摄角度。你的回答需要简短、表达自然流畅，请避免主观描述，只谈论图像内容。"
    }
  }

  async function login() : Promise<UserInfo | null> {
    // first try to load lfss-config from url params
    const urlParams = new URLSearchParams(window.location.search);
    const urlLFSSEndpoint = urlParams.get("lfss-endpoint");
    const urlLFSSToken = urlParams.get("lfss-token");

    backend.configureLFSS({
      endpoint: urlLFSSEndpoint || backendUrl.value,
      token: urlLFSSToken || hashkey.value
    }).configurePath({
      imageDir: settings.value.imageDir,
      metaDir: settings.value.metaDir,
    })
    const userInfo = await backend.auth();
    if (userInfo) {
      user.value = userInfo;
    }
    else {
      user.value = null;
    }
    return user.value;
  }

  function logout() {
    hashkey.value = "";
    user.value = null;
    settings.value = defaultSettings();
  }

  /**
   * Verify if the user is logged in, if not, redirect to login page
   */
  function verifyLoginRedirect() {
    const router = useRouter();
    if (!user.value) {
      router.push({ name: 'login' });
    }
    else {
      login()     // verify the token
        .then((user) => {
          if (!user) {
            router.push({ name: 'login' });
          }
        })
        .catch(() => {
          router.push({ name: 'login' });
        });
    }
  }

  return {
    hashkey, user, login, logout, backendUrl,
    verifyLoginRedirect, backend, settings,
  }
}, {
  persist: {
    key: "UserInfo",
  }
})
