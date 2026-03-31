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
  /** Экземпляр адаптера для skills-transpiler (null если адаптер не поддерживает skills). */
  skills: SkillAdapter | null;
  /** Экземпляр адаптера для agents-transpiler (null если адаптер не поддерживает agents). */
  agents: AgentAdapter | null;
  /** Относительный путь к корневой директории agent-специфичных файлов. */
  targetRoot: string;
  /** Список относительных путей к файлам за пределами targetRoot, генерируемых транспилерами. */
  targetFiles: string[];
  /** Имена файлов для рекурсивного поиска в project tree при создании .agloom/instructions/ бэкапа. */
  projectFiles: string[];
  /** Имя собственного файла инструкций агента, или null если агент не имеет собственного формата. */
  instructionsFile: string | null;
  /** Идентификаторы адаптеров, от которых зависит данный адаптер. */
  dependsOn: string[];
  /** Признак скрытого адаптера. */
  hidden: boolean;
  /** Список путей относительно project root, импортируемых в overlay при init. */
  overlayImportPaths: string[];
  /** Пути к agent-specific каталогам. */
  paths: {
    skills?: string;
    agents?: string;
    docs?: string;
    schemas?: string;
  };
}

/** Результат выполнения очистки. */
export interface CleanOutcome {
  /** Количество удалённых файлов. */
  removedCount: number;
  /** Сообщения об ошибках. */
  errors: string[];
}

/** Результат выполнения импорта. */
export interface InitOutcome {
  /** Количество скопированных файлов. */
  copiedCount: number;
  /** Сообщения об ошибках. */
  errors: string[];
}

/** Результат одного шага транспиляции. */
export interface TranspilerStepOutcome {
  /** Отображаемое имя шага. */
  name: "Instructions" | "Skills" | "Agents" | "Overlay";
  /** Количество успешно записанных файлов. */
  writtenCount: number;
  /** Сообщения об ошибках (пустой массив при отсутствии). */
  errors: string[];
}
