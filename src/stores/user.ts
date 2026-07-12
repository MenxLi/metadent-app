import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { BackendCalls } from '@/api'
import { useRouter } from 'vue-router'
import { type UserInfo } from '@/api'
import { useUiStateStore } from './uistate'

interface UserSettingsAiFeatureSet {
  autoLabelCurrentPage: boolean;
  overallDescriptionOnLoad: boolean;
  overallDescriptionImprovement: boolean;
  regionDescriptionOnDraw: boolean;
  regionDescriptionProposal: boolean;
  regionRefineOnDoubleClick: boolean;
  regionReferringOnEnter: boolean;
  transcript: boolean;
  enableChat: boolean;
}

interface UserSettings {
  imageDir: string;
  metaDir: string;
  loadNextGoToUnlabeled: boolean;
  showImageLabelerHint: boolean;
  enableAIHelpers: boolean;
  aiBackendUrl: string;
  aiBackendToken: string;
  aiModelName: string;
  aiFeatureSet: UserSettingsAiFeatureSet;
  aiChatPredefinedQueries: string[];
}

const DEFAULT_AI_CHAT_PREDEFINED_QUERIES = [
  "Describe the image in detail, focusing on the visible content. Provide a comprehensive summary of the main elements in the image, all in one paragraph.",
  "帮我详细描述一下这张图的内容，围绕图像内的可见内容进行介绍，全面总结画面主体内容，总结为一段话。",
];

function defaultSettings(): UserSettings {
  return {
    imageDir: "public/images/",
    metaDir: "public/meta/",
    loadNextGoToUnlabeled: true,
    showImageLabelerHint: true,
    enableAIHelpers: false,
    aiBackendUrl: "",
    aiBackendToken: "",
    aiModelName: "",
    aiFeatureSet: {
      autoLabelCurrentPage: true,
      overallDescriptionOnLoad: true,
      overallDescriptionImprovement: true,
      regionDescriptionOnDraw: true,
      regionDescriptionProposal: true,
      regionRefineOnDoubleClick: true,
      regionReferringOnEnter: true,
      transcript: true,
      enableChat: true,
    },
    aiChatPredefinedQueries: [...DEFAULT_AI_CHAT_PREDEFINED_QUERIES],
  }
}

function sanitizeAiChatPredefinedQueries(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_AI_CHAT_PREDEFINED_QUERIES];
  }

  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))]
}

function normalizeSettings(value?: Partial<UserSettings>): UserSettings {
  const defaults = defaultSettings()

  return {
    ...defaults,
    ...value,
    aiFeatureSet: {
      ...defaults.aiFeatureSet,
      ...(value?.aiFeatureSet ?? {}),
    },
    aiChatPredefinedQueries: sanitizeAiChatPredefinedQueries(value?.aiChatPredefinedQueries),
  }
}

export const useUserStore = defineStore('UserInfo', () => {
  const backendUrl = ref("http://localhost:8000");
  const hashkey = ref("");
  const backend = new BackendCalls();
  const user: Ref<UserInfo | null> = ref(null);
  const settings = ref(normalizeSettings());

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

      // warn user if backend version is too low
      const validateResult = await backend.validateBackendVersion();
      if (!validateResult.valid) {
        useUiStateStore().msg.set(
          `LFSS backend version ${validateResult.current} is below the minimum supported version ${validateResult.minimum}. Some features may not work correctly.`,
          'warning'
        );
      }
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


  function disableAIHelpers() {
    settings.value.enableAIHelpers = false
  }

  function updateAiChatPredefinedQueries(queries: string[]) {
    settings.value.aiChatPredefinedQueries = sanitizeAiChatPredefinedQueries(queries)
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
    disableAIHelpers,
    updateAiChatPredefinedQueries,
  }
}, {
  persist: {
    key: "UserInfo",
    afterHydrate: ({ store }) => {
      store.settings = normalizeSettings(store.settings)
    },
  }
})
