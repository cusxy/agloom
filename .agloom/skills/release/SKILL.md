---
name: release
description: >-
  Выпуск новой версии пакета: bump version, tag, push, npm publish
  через GitHub Actions, создание GitHub Release с release notes.
  Используй когда пользователь просит выпустить релиз, создать
  новую версию, или опубликовать пакет.
blueprint: schemas/draft/skill.schema.yml
---

# Release

Ты выполняешь релиз новой версии пакета agloom.
Процесс разделён на два этапа: **Prepare** и **Publish**.
Между ними — обязательное ожидание CI.

Ключевые слова ТРЕБУЕТСЯ, ЗАПРЕЩАЕТСЯ, СЛЕДУЕТ, НЕ СЛЕДУЕТ, МОЖЕТ
интерпретируются согласно RFC 2119.

## Как работает CI/CD

- `ci.yml` запускается на каждый push в main — build + test на Node 20/22/24.
- `release.yml` запускается на push тега `v*` — build, test, npm publish
  (OIDC trusted publisher), deploy docs + landing.
- **Пуш тега = публикация.** ЗАПРЕЩАЕТСЯ пушить тег до зелёного CI,
  потому что пуш тега немедленно запускает npm publish и deploy.

## Этап 1: Prepare

1. **Определи версию.** Если версия не указана пользователем, ТРЕБУЕТСЯ
   спросить. ТРЕБУЕТСЯ следовать semver: patch для фиксов, minor для фич,
   major для breaking changes.

2. **Локальная проверка.** ТРЕБУЕТСЯ выполнить `pnpm run build && pnpm run test`.
   Если падает — ТРЕБУЕТСЯ остановить релиз и исправить.

3. **Проверка под CI.** ТРЕБУЕТСЯ выполнить `CI=1 pnpm run test`,
   потому что поведение Ink и некоторых тестов отличается при `CI=1`.
   Если падает — ТРЕБУЕТСЯ остановить релиз и исправить.

4. **Синхронизация с remote.** ТРЕБУЕТСЯ проверить расхождения между
   локальной и удалённой main: `git status` и `git log origin/main..HEAD`.
   Если есть неопубликованные коммиты — ТРЕБУЕТСЯ выполнить `git push`.
   Это запустит `ci.yml` на main.

5. **Дождись CI.** ТРЕБУЕТСЯ выполнить `gh run watch` на запущенном workflow run.
   Если CI падает — ТРЕБУЕТСЯ сообщить пользователю, исправить проблему,
   запушить фикс и повторить ожидание CI.
   ЗАПРЕЩАЕТСЯ переходить к этапу Publish до зелёного CI,
   потому что этап Publish создаёт тег, а пуш тега запускает публикацию.

## Этап 2: Publish

ТРЕБУЕТСЯ переходить сюда только после успешного прохождения CI.

1. **Bump version.** ТРЕБУЕТСЯ обновить `version` в корневом `package.json`.

2. **Commit** — `chore: bump version to X.Y.Z`.

3. **Tag** — `git tag vX.Y.Z`.

4. **Push коммит и тег** — `git push && git push --tags`.
   Пуш тега запустит `release.yml`, который выполнит build, test,
   npm publish, deploy docs и landing.

5. **GitHub Release.** ТРЕБУЕТСЯ создать release с release notes:

   ```
   gh release create vX.Y.Z --title "vX.Y.Z" --latest --notes "…"
   ```

## Формат release notes

- ТРЕБУЕТСЯ собрать коммиты между предыдущим тегом и новым:
  `git log --oneline vPREV..vX.Y.Z`.
- СЛЕДУЕТ группировать по секциям: **Features**, **Improvements**, **Fixes**
  (пропустить пустые секции).
- ЗАПРЕЩАЕТСЯ включать фиксы багов, которые были введены и исправлены
  между релизами, потому что они никогда не присутствовали в релизной
  версии и не интересны пользователям.
- ТРЕБУЕТСЯ завершить строкой:
  `**Full Changelog**: https://github.com/cusxy/agloom/compare/vPREV...vX.Y.Z`.

## Ограничения

- ЗАПРЕЩАЕТСЯ публиковать в npm вручную, потому что это делает GitHub Actions
  через OIDC trusted publisher.
- Предыдущий тег: `git tag -l 'v*' --sort=-version:refname | head -1`.
