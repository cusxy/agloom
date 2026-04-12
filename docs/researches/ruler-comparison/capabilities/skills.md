---
type: research
summary: >-
  Сравнение Skills Support между Ruler и Agloom: копирование директорий
  vs transpiler pipeline.
description: >-
  Детальный анализ подходов к распространению skills: Ruler копирует
  директории без трансформации (13 функций, 1400+ строк), Agloom
  использует generic pipeline discover -> transform -> write.
relates:
  - docs/researches/ruler-comparison/RESEARCH.md
---

# Skills Support

## 7. Skills Support

### Ruler

Skills хранятся в `.ruler/skills/<name>/`. `SkillsProcessor.ts`
обнаруживает skills, проверяет наличие `SKILL.md`, копирует целые
директории в agent-specific paths.

Копирование -- без трансформации. Каждый агент с `supportsNativeSkills()`
получает идентичную копию. Реализация содержит отдельную функцию
для каждого агента (`propagateSkillsForClaude`, `propagateSkillsForCodex`
и т.д.) -- 13 функций с идентичным телом, различающихся только путём
назначения. Суммарно ~1400 строк.

Атомарная замена: copy to temp dir, rm existing, rename temp.

### Agloom

Skills хранятся в `.agloom/skills/<name>/`. Skills transpiler работает
по pipeline discover -> transform -> write. Каждый `SkillAdapter` может
трансформировать содержимое skill-директории при необходимости.

Pipeline generic: один код обрабатывает все адаптеры.

### Плюсы Ruler

- Атомарная замена (copy-to-temp + rename) -- безопасна при сбоях.
- Простота модели: копирование без трансформации.

### Минусы Ruler

- 1400+ строк дублирования: 13 функций с идентичной логикой.
- Нет трансформации: невозможно адаптировать skill под агента.
- `cleanupSkillsDirectories` также содержит copy-paste для каждого агента.

### Плюсы Agloom

- Generic pipeline: один код для всех адаптеров.
- Трансформация возможна: адаптер может модифицировать skill.
- Нет дублирования.

### Минусы Agloom

- Нет атомарной замены при записи skills (стандартный write).
- Pipeline сложнее для понимания, чем простое копирование.

## Рекомендации

- **Атомарная замена skills**: заимствовать подход copy-to-temp + rename
  для повышения надёжности записи skills (low priority).
