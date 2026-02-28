import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { BackendCalls } from '@/api'
import { useRouter } from 'vue-router'
import { type UserInfo } from '@/api'
import { useUiStateStore } from './uistate'

function parseVersion(version: string): [number, number, number] {
  const clean = version.trim().replace(/^v/i, '').split('-')[0] ?? '';
  const parts = clean.split('.').map((v) => Number.parseInt(v, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isVersionLessThan(current: string, minimum: string): boolean {
  const [curMajor, curMinor, curPatch] = parseVersion(current);
  const [minMajor, minMinor, minPatch] = parseVersion(minimum);
  console.log(`Comparing versions: current=${current} (parsed: ${curMajor}.${curMinor}.${curPatch}), minimum=${minimum} (parsed: ${minMajor}.${minMinor}.${minPatch})`);
  if (curMajor !== minMajor) return curMajor < minMajor;
  if (curMinor !== minMinor) return curMinor < minMinor;
  return curPatch < minPatch;
}

interface UserSettings {
  imageDir: string;
  metaDir: string;
  loadNextGoToUnlabeled: boolean;
  enableAIAutoGen: boolean;
  aiBackendUrl: string;
  aiBackendToken: string;
}

const MIN_SUPPORTED_BACKEND_VERSION = '0.18.0';
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
      aiBackendToken: "",
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

  async function warnIfBackendVersionTooLow() {
    const uiStateStore = useUiStateStore();
    try {
      const backendVersion = await backend.version();
      if (isVersionLessThan(backendVersion, MIN_SUPPORTED_BACKEND_VERSION)) {
        uiStateStore.msg.set(
          `LFSS backend version ${backendVersion} is below the minimum supported version ${MIN_SUPPORTED_BACKEND_VERSION}. Some features may not work correctly.`,
          'warning'
        );
      }
    } catch (error) {
      console.warn('Failed to check LFSS backend version:', error);
    }
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
      await warnIfBackendVersionTooLow();
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
