import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "MetaDent App",
  description: "A intra-oral image annotation app for semi-structured vision-language labeling",
  base: '/metadent-app/docs/',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick start', link: '/quick-start' }
    ],

    sidebar: [
      {
        text: 'Setup',
        items: [
          { text: 'Setup Backend', link: '/setup-backend' },
          { text: 'Configure Frontend', link: '/setup-configure' },
          { text: 'Build from Source', link: '/setup-build' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/menxli/metadent-app' }
    ]
  }
})
