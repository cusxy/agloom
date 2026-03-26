/**
 * Реестр адаптеров — встроенный массив AdapterRegistryEntry.
 * Spec: docs/specs/cli.md § Реестр адаптеров
 */

import {
  ClaudeAdapter,
  OpenCodeAdapter,
} from "../instructions-transpiler/index.js";
import {
  ClaudeSkillAdapter,
  OpenCodeSkillAdapter,
} from "../skills-transpiler/index.js";
import {
  ClaudeAgentAdapter,
  OpenCodeAgentAdapter,
} from "../agents-transpiler/index.js";
import type { AdapterRegistryEntry } from "./types.js";

/**
 * Реестр является единственным местом определения списка поддерживаемых адаптеров.
 * Команды transpile и adapters читают данные из этого реестра.
 */
export const adapterRegistry: AdapterRegistryEntry[] = [
  {
    id: "claude",
    description: "Claude Code",
    instructions: new ClaudeAdapter(),
    skills: new ClaudeSkillAdapter(),
    agents: new ClaudeAgentAdapter(),
    targetRoot: ".claude",
    targetFiles: ["CLAUDE.md"],
  },
  {
    id: "opencode",
    description: "OpenCode",
    instructions: new OpenCodeAdapter(),
    skills: new OpenCodeSkillAdapter(),
    agents: new OpenCodeAgentAdapter(),
    targetRoot: ".opencode",
    targetFiles: ["AGENTS.md"],
  },
];
