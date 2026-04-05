import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Agloom",
  tagline:
    "Transpile canonical agent configurations across AI coding assistants",
  url: "https://agloom.sh",
  baseUrl: "/",
  organizationName: "cusxy",
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
