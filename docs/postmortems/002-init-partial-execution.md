# Постмортем: `init` допускает частичное выполнение и ложную зелёную галочку

**Дата:** 2026-03-27
**Severity:** medium
**Статус:** исправлено

## Описание бага

При выполнении `agloom init --all` на проекте, где `.agloom/overlays/claude/`
уже существовала (после предыдущего init), вывод содержал:

```
Initializing...
  ✓ 0 project files backed up to .agloom/project/
  ✗ .agloom/overlays/claude/ already exists. Use --force to overwrite.

Done. 0 files copied.
```

Проблемы:
1. Зелёная галочка "✓ 0 project files backed up" — ложный сигнал успеха
   при общем провале операции.
2. Backup Project Files выполнялся до проверки overlay, допуская
   частичное выполнение и неконсистентное состояние `.agloom/`.
3. Проверки `.agloom/project/` и `.agloom/overlays/{id}/` выполнялись
   независимо, допуская сценарий "backup ok → overlay fail".

## Корневая причина

Команда `init` проверяла существование каждой поддиректории `.agloom/`
индивидуально (`.agloom/project/`, `.agloom/overlays/{id}/`), а не
наличие `.agloom/` целиком. Это допускало частичное выполнение:
`backupProjectFiles` мог создать `.agloom/project/` до того как
`initFiles` обнаруживал конфликт в `.agloom/overlays/`.

## Исправление

Добавлен top-level pre-check в `InitView` (`app.tsx`): если `.agloom/`
существует и `--force` не указан — операция завершается с ошибкой
до вызова `backupProjectFiles` и `initFiles`.

Сообщение об ошибке:
```
.agloom/ already exists. Use --force to reinitialize.
```

Индивидуальные проверки в `backupProjectFiles` и `initFiles` сохранены
как defense-in-depth.

## Затронутые файлы

- `src/cli/app.tsx` — top-level pre-check в InitView.
- `src/cli/__tests__/init-command.spec.ts` — обновление 4 тестов + 1 новый.

## Регрессионные тесты

1. `.agloom/ already exists` — блокирует init без --force (overlay-файлы)
2. `при --all, если .agloom/ существует` — блокирует init --all
3. `при наличии .agloom/project/` — top-level check перехватывает
4. `при наличии .agloom/ без --force не выполняет ни Backup, ни Init`
5. `при существующей пустой .agloom/ блокирует init без --force`

## Уроки

- Операции с файловой системой (init, backup) должны быть атомарными:
  либо все шаги выполняются, либо ни один. Top-level pre-check —
  простой способ обеспечить атомарность.
- Частичное выполнение с "зелёной галочкой" хуже полного отказа:
  пользователь видит ложный сигнал успеха и не понимает состояние системы.
