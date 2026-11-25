import { defineConfig } from 'vocs/config'

export default defineConfig({
  title: 'EEZ Protocol Documents',
  baseUrl: 'https://docs.eez.io',
  renderStrategy: 'full-static',
  head: { base: false },
  colorScheme: 'dark',
  accentColor: '#3BE57E',
  logoUrl: '/logo.svg',
  iconUrl: '/favicon.svg',
  description: 'Specifications for the EEZ core protocol contracts.',
  topNav: [
    { text: 'Docs', link: '/' },
    { text: 'Quickstarts', link: 'https://build.eez.io', external: true },
    { text: 'Dashboard', link: 'https://rollupx.eez.dev/dashboard', external: true },
    { text: 'GitHub', link: 'https://github.com/eez-association', external: true },
    { text: 'Get in touch', link: 'https://tally.so/r/NpLo4l', external: true },
  ],
  // Serialized with toString, so it must stay self-contained. Synced pages map back
  // to upstream `docs/` names (blobs/blob-format-spec.md → blobs/BLOB_FORMAT_SPEC.md).
  editLink: {
    text: 'Suggest changes to this page',
    link: (filePath) =>
      filePath.endsWith('.mdx')
        ? `https://github.com/eez-association/eez-protocol-docs/edit/main/src/pages/${filePath}`
        : `https://github.com/eez-association/eez-core-protocol/edit/main/docs/${filePath.replace(
            /[^/]+(?=\.md$)/,
            (name) => name.toUpperCase().replace(/-/g, '_'),
          )}`,
  },
  // Images come from scripts/og/build.mjs (GitHub Pages can't serve Vocs' dynamic /api/og).
  // Serialized with toString like editLink, so it must stay self-contained.
  ogImageUrl: (path, { baseUrl }) =>
    `${baseUrl}/og/${path.replace(/^\/$/, '/index').slice(1)}.png`,
  socials: [
    { icon: 'github', link: 'https://github.com/eez-association/eez-core-protocol' },
    { icon: 'x', link: 'https://x.com/etheconomiczone' },
    // @ts-expect-error the 'website' icon and label come from patches/vocs+2.9.0.patch (Socials.client.js)
    { icon: 'website', link: 'https://eez.io', label: 'EEZ website' },
  ],
  sidebar: [
    { text: 'Introduction', link: '/' },
    { text: 'Walkthrough', link: '/eez-walkthrough' },
    { text: 'Integrate a chain', link: '/integrate-a-chain' },
    { text: 'Build a dApp', link: '/build-a-dapp' },
    { text: 'Build with AI', link: '/build-with-ai' },
    {
      text: 'Specification',
      link: 'https://github.com/eez-association/eez-core-protocol/tree/main/docs',
    },
  ],
})
