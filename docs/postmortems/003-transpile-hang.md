# Постмортем: `transpile` зависает после завершения работы

**Дата:** 2026-03-27
**Severity:** high
**Статус:** исправлено

## Описание бага

При выполнении `agloom transpile --all` (или `--adapter`) процесс завершал
всю работу, выводил "Done. 53 files written.", но не завершался — анимация
spinner продолжала крутиться бесконечно. Пользователю приходилось
завершать процесс вручную через Ctrl+C.

```
⠏ Transpiling for claude...
  ✓ Instructions        0 files
  ✓ Skills        0 files
  ✓ Agents        0 files
  ✓ Overlay        53 files
⠏ Transpiling for opencode...
  ...
Done. 53 files written.
^C
```

## Корневая причина

Компоненты `TranspileView` и `TranspileAllView` в `app.tsx` рендерили
`<Spinner type="dots" />` (из `ink-spinner`) безусловно — даже после
завершения всех шагов транспиляции (когда `done = true`).

Две проблемы:

1. **Spinner не останавливался.** Компонент `ink-spinner` создаёт
   внутренний `setInterval` для анимации символов. Этот интервал
   удерживал event loop Node.js и не давал процессу завершиться.

2. **Ink app не получала сигнал завершения.** Ни один компонент не вызывал
   `useApp().exit()`, поэтому Ink не знал, что приложение выполнило свою
   задачу и может быть размонтировано.

## Исправление

В обоих компонентах (`TranspileView`, `TranspileAllView`):

1. Добавлен вызов `useApp().exit()` через `useEffect` при `done = true` —
   сигнализирует Ink о завершении приложения.

2. Spinner заменён на условный рендеринг: при `done = true` отображается
   статичный `✓`, при `done = false` — анимированный `<Spinner>`.

```tsx
// До:
<Spinner type="dots" /> Transpiling for {r.adapterId}...

// После:
{done ? <Text color="green">✓</Text> : <Spinner type="dots" />} Transpiling for {r.adapterId}...
```

## Сопутствующее исправление: выравнивание вывода

Исправлено выравнивание колонок в TUI. Ранее между именем шага и числом
файлов стоял фиксированный отступ `{"        "}` (8 пробелов), из-за чего
числа не были выровнены (имена шагов имеют разную длину):

```
# До:
  ✓ Instructions        0 files
  ✓ Skills        0 files
  ✓ Overlay        53 files

# После:
  ✓ Instructions     0 files
  ✓ Skills           0 files
  ✓ Overlay         53 files
```

Исправлено через `outcome.name.padEnd(14)` для имени и
`String(outcome.writtenCount).padStart(4)` для числа.

## Затронутые файлы

- `src/cli/app.tsx` — `TranspileView`, `TranspileAllView`: добавлен
  `useApp().exit()`, условный рендеринг spinner/checkmark, выравнивание колонок.
- `src/cli/__tests__/transpile-command.spec.ts` — 2 регрессионных теста.

## Регрессионные тесты

1. `при --adapter заменяет spinner на ✓ в заголовке после завершения транспиляции`
2. `при --all заменяет spinner на ✓ в заголовках после завершения транспиляции`

## Уроки

- Анимированные компоненты (spinner, progress bar) в CLI-приложениях на Ink
  создают активные таймеры, которые удерживают event loop. Они ДОЛЖНЫ быть
  размонтированы или заменены статичными элементами при завершении работы.
- Ink-приложение должно явно вызывать `useApp().exit()` по завершении
  работы, иначе процесс не завершится даже при отсутствии активных таймеров.
