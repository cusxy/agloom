/**
 * Реестр адаптеров — встроенный массив AdapterRegistryEntry.
 * Spec: docs/specs/cli.md § Реестр адаптеров
 * Spec: docs/specs/adapter-registry-ext.md § Обновление реестра адаптеров
 */

import {
  ClaudeAdapter,
  OpenCodeAdapter,
  AgentsMdAdapter,
  GeminiAdapter,
  KiloCodeAdapter,
  CodexAdapter,
} from "../instructions-transpiler/index.js";
import {
  ClaudeSkillAdapter,
  OpenCodeSkillAdapter,
  KiloCodeSkillAdapter,
  CodexSkillAdapter,
  GeminiSkillAdapter,
} from "../skills-transpiler/index.js";
import {
  ClaudeAgentAdapter,
  OpenCodeAgentAdapter,
  KiloCodeAgentAdapter,
  GeminiAgentAdapter,
  CodexAgentAdapter,
} from "../agents-transpiler/index.js";
import {
  ClaudeMcpAdapter,
  OpenCodeMcpAdapter,
} from "../mcp-transpiler/index.js";
import {
  ClaudePermissionsAdapter,
  OpenCodePermissionsAdapter,
} from "../permissions-transpiler/index.js";
import type { AdapterRegistryEntry } from "./types.js";

/**
 * allowedAgentIds — список идентификаторов агентов, имеющих собственный
 * файл инструкций (instructionsFile !== null). Используется для валидации
 * допустимых agentId в <!-- agent:X --> блоках.
 */
const allowedAgentIds = ["claude", "agentsmd", "gemini"];

/**
 * Реестр является единственным местом определения списка поддерживаемых адаптеров.
 * Команды transpile и adapters читают данные из этого реестра.
 */
export const adapterRegistry: AdapterRegistryEntry[] = [
  {
    id: "claude",
    description: "Claude Code",
    instructions: new ClaudeAdapter(allowedAgentIds),
    skills: new ClaudeSkillAdapter(),
    agents: new ClaudeAgentAdapter(),
    mcp: new ClaudeMcpAdapter(),
    permissions: new ClaudePermissionsAdapter(),
    targetFiles: ["CLAUDE.md", ".mcp.json"],
    projectFiles: ["CLAUDE.md"],
    instructionsFile: "CLAUDE.md",
    dependsOn: [],
    hidden: false,
    overlayImportPaths: [".claude", "**/CLAUDE.md", ".mcp.json"],
    paths: {
      skills: ".claude/skills",
      agents: ".claude/agents",
      docs: ".claude/docs",
      schemas: ".claude/schemas",
    },
  },
  {
    id: "opencode",
    description: "OpenCode",
    instructions: new OpenCodeAdapter(),
    skills: new OpenCodeSkillAdapter(),
    agents: new OpenCodeAgentAdapter(),
    mcp: new OpenCodeMcpAdapter(),
    permissions: new OpenCodePermissionsAdapter(),
    targetFiles: ["opencode.json"],
    projectFiles: [],
    instructionsFile: null,
    dependsOn: ["agentsmd"],
    hidden: false,
    overlayImportPaths: [".opencode", "opencode.json"],
    paths: {
      skills: ".opencode/skills",
      agents: ".opencode/agents",
      docs: ".opencode/docs",
      schemas: ".opencode/schemas",
    },
  },
  {
    id: "agentsmd",
    description: "AGENTS.md (Codex, OpenCode, KiloCode, ...)",
    instructions: new AgentsMdAdapter(allowedAgentIds),
    skills: null,
    agents: null,
    mcp: null,
    permissions: null,
    targetFiles: ["AGENTS.md", "AGENTS.override.md"],
    projectFiles: ["AGENTS.md", "AGENTS.override.md"],
    instructionsFile: "AGENTS.md",
    dependsOn: [],
    hidden: true,
    overlayImportPaths: [".agents", "**/AGENTS.md", "**/AGENTS.override.md"],
    paths: {},
  },
  {
    id: "kilocode",
    description: "KiloCode",
    instructions: new KiloCodeAdapter(),
    skills: new KiloCodeSkillAdapter(),
    agents: new KiloCodeAgentAdapter(),
    mcp: null,
    permissions: null,
    targetFiles: [],
    projectFiles: [],
    instructionsFile: null,
    dependsOn: ["agentsmd"],
    hidden: false,
    overlayImportPaths: [".kilo"],
    paths: {
      skills: ".kilo/skills",
      agents: ".kilo/agents",
      docs: ".kilo/docs",
      schemas: ".kilo/schemas",
    },
  },
  {
    id: "codex",
    description: "Codex",
    instructions: new CodexAdapter(),
    skills: new CodexSkillAdapter(),
    agents: new CodexAgentAdapter(),
    mcp: null,
    permissions: null,
    targetFiles: [],
    projectFiles: [],
    instructionsFile: null,
    dependsOn: ["agentsmd"],
    hidden: false,
    overlayImportPaths: [".codex", ".agents"],
    paths: {
      skills: ".agents/skills",
      agents: ".codex/agents",
    },
  },
  {
    id: "gemini",
    description: "Gemini",
    instructions: new GeminiAdapter(allowedAgentIds),
    skills: new GeminiSkillAdapter(),
    agents: new GeminiAgentAdapter(),
    mcp: null,
    permissions: null,
    targetFiles: ["GEMINI.md"],
    projectFiles: ["GEMINI.md"],
    instructionsFile: "GEMINI.md",
    dependsOn: [],
    hidden: false,
    overlayImportPaths: [".gemini", "**/GEMINI.md"],
    paths: {
      skills: ".gemini/skills",
      agents: ".gemini/agents",
      docs: ".gemini/docs",
      schemas: ".gemini/schemas",
    },
  },
];
