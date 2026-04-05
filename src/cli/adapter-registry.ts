/**
 * Реестр адаптеров — встроенный массив AdapterRegistryEntry.
 * Spec: docs/specs/cli.md § Реестр адаптеров
 * Spec: docs/specs/adapter-registry-ext.md § Обновление реестра адаптеров
 */

import {
  ClaudeAdapter,
  OpenCodeAdapter,
  AgentsMdAdapter,
} from "../instructions-transpiler/index.js";
import {
  ClaudeSkillAdapter,
  OpenCodeSkillAdapter,
} from "../skills-transpiler/index.js";
import {
  ClaudeAgentAdapter,
  OpenCodeAgentAdapter,
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
const allowedAgentIds = ["claude", "agentsmd"];

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
    targetRoot: ".claude",
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
    targetRoot: ".opencode",
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
    targetRoot: ".agents",
    targetFiles: ["AGENTS.md", "AGENTS.override.md"],
    projectFiles: ["AGENTS.md", "AGENTS.override.md"],
    instructionsFile: "AGENTS.md",
    dependsOn: [],
    hidden: true,
    overlayImportPaths: [".agents", "**/AGENTS.md", "**/AGENTS.override.md"],
    paths: {},
  },
];
