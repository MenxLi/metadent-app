import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { BackendCalls } from '@/api'
import { useRouter } from 'vue-router'
import { type UserInfo } from '@/api'

interface UserSettings {
  imageDir: string;
  metaDir: string;
  loadNextGoToUnlabeled: boolean;
  enableAIAutoGen: boolean;
  aiBackendUrl: string;
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
      loadNextGoToUnlabeled: true,
      enableAIAutoGen: true,
      aiBackendUrl: "",
    }
  }

  function configureOverride() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLFSSEndpoint = urlParams.get("lfss-endpoint");
    const urlLFSSToken = urlParams.get("lfss-token");
    const urlImageDir = urlParams.get("cfg-imagedir");
    const urlMetaDir = urlParams.get("cfg-metadir");
    const urlNextUnlabeled = urlParams.get("cfg-next-goto-unlabeled");

    if (urlLFSSEndpoint) backendUrl.value = urlLFSSEndpoint;
    if (urlLFSSToken) hashkey.value = urlLFSSToken;
    if (urlImageDir) settings.value.imageDir = urlImageDir;
    if (urlMetaDir) settings.value.metaDir = urlMetaDir;
    if (urlNextUnlabeled) settings.value.loadNextGoToUnlabeled = (urlNextUnlabeled === 'true' || urlNextUnlabeled === '1');
    console.log(
      "Configured overrides from URL parameters",
      { urlLFSSEndpoint, urlLFSSToken, urlImageDir, urlMetaDir, urlNextUnlabeled }
    );
  }

  async function login(): Promise<UserInfo | null> {

    backend.configureLFSS({
      endpoint: backendUrl.value,
      token: hashkey.value
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


  function disableAIAutoGen() {
    settings.value.enableAIAutoGen = false
  }

  /**
   * Verify if the user is logged in, if not, redirect to login page
   */
  function verifyLoginRedirect() {
    const router = useRouter();
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

  return {
    hashkey, user, login, logout, backendUrl,
    configureOverride, verifyLoginRedirect, backend, settings,
    disableAIAutoGen,
  }
}, {
  persist: {
    key: "UserInfo",
  }
})
