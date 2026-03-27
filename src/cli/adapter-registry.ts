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
  AgentsMdSkillAdapter,
} from "../skills-transpiler/index.js";
import {
  ClaudeAgentAdapter,
  OpenCodeAgentAdapter,
  AgentsMdAgentAdapter,
} from "../agents-transpiler/index.js";
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
    targetRoot: ".claude",
    targetFiles: ["CLAUDE.md"],
    projectFiles: ["CLAUDE.md", "CLAUDE.local.md"],
    instructionsFile: "CLAUDE.md",
    dependsOn: [],
    hidden: false,
  },
  {
    id: "opencode",
    description: "OpenCode",
    instructions: new OpenCodeAdapter(),
    skills: new OpenCodeSkillAdapter(),
    agents: new OpenCodeAgentAdapter(),
    targetRoot: ".opencode",
    targetFiles: [],
    projectFiles: [],
    instructionsFile: null,
    dependsOn: ["agentsmd"],
    hidden: false,
  },
  {
    id: "agentsmd",
    description: "AGENTS.md (Codex, OpenCode, KiloCode, ...)",
    instructions: new AgentsMdAdapter(allowedAgentIds),
    skills: new AgentsMdSkillAdapter(),
    agents: new AgentsMdAgentAdapter(),
    targetRoot: ".agents",
    targetFiles: ["AGENTS.md"],
    projectFiles: ["AGENTS.md"],
    instructionsFile: "AGENTS.md",
    dependsOn: [],
    hidden: true,
  },
];
