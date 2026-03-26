/**
 * Types for CLI module.
 * Spec: docs/specs/cli.md § Типы данных
 */

import type { Adapter } from "../instructions-transpiler/index.js";
import type { SkillAdapter } from "../skills-transpiler/index.js";
import type { AgentAdapter } from "../agents-transpiler/index.js";

/** Запись реестра адаптеров. */
export interface AdapterRegistryEntry {
  /** Уникальный идентификатор адаптера. */
  id: string;
  /** Человекочитаемое описание адаптера. */
  description: string;
  /** Экземпляр адаптера для instructions-transpiler. */
  instructions: Adapter;
  /** Экземпляр адаптера для skills-transpiler. */
  skills: SkillAdapter;
  /** Экземпляр адаптера для agents-transpiler. */
  agents: AgentAdapter;
}

/** Результат одного шага транспиляции. */
export interface TranspilerStepOutcome {
  /** Отображаемое имя шага. */
  name: "Instructions" | "Skills" | "Agents";
  /** Количество успешно записанных файлов. */
  writtenCount: number;
  /** Сообщения об ошибках (пустой массив при отсутствии). */
  errors: string[];
}
