import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import agloomLlmsPlugin from "./src/plugins/agloom-llms";

const config: Config = {
  title: "Agloom",
  tagline: "Transpile canonical agent configurations across AI coding assistants",
  url: "https://agloom.sh",
  baseUrl: "/",
  organizationName: "cusxies",
  projectName: "agloom",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "throw",

  presets: [
    [
      "classic",
      {
        docs: {
          path: "../docs",
          routeBasePath: "docs",
          sidebarPath: "./sidebars.ts",
          exclude: [
            "postmortems/**",
            "researches/**",
            "specs/**",
          ],
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],

  plugins: [agloomLlmsPlugin],

  headTags: [
    {
      tagName: "link",
      attributes: {
        rel: "alternate",
        type: "text/plain",
        href: "/llms.txt",
        title: "LLM-friendly documentation index",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "alternate",
        type: "text/plain",
        href: "/llms-full.txt",
        title: "Full documentation as plain text for LLMs",
      },
    },
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Agloom",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docs",
          label: "Docs",
          position: "left",
        },
        {
          href: "https://github.com/cusxy/agloom",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Copyright \u00A9 ${new Date().getFullYear()} Agloom contributors. Apache-2.0 License.`,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
