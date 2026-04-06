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

## Шаги

1. **Определи версию** — спроси пользователя, если не указана.
   Следуй semver: patch для фиксов, minor для фич, major для breaking changes.

2. **Bump version** — обнови `version` в корневом `package.json`.

3. **Commit** — `chore: bump version to X.Y.Z`.

4. **Tag** — `git tag vX.Y.Z`.

5. **Push** — `git push && git push --tags`.
   GitHub Actions workflow `release.yml` автоматически опубликует пакет
   в npm через OIDC trusted publisher (секреты не нужны).

6. **GitHub Release** — создай release с ручными release notes:

   ```
   gh release create vX.Y.Z --title "vX.Y.Z" --latest --notes "…"
   ```

## Формат release notes

- Собери коммиты между предыдущим тегом и новым: `git log --oneline vPREV..vX.Y.Z`.
- Сгруппируй по секциям: **Features**, **Improvements**, **Fixes** (пропусти пустые секции).
- Заверши строкой: `**Full Changelog**: https://github.com/cusxy/agloom/compare/vPREV...vX.Y.Z`.

## Важно

- Перед релизом убедись что `pnpm run build && pnpm run test` проходят.
- НЕ публикуй в npm вручную — это делает GitHub Actions.
- Предыдущий тег можно найти через `git tag -l 'v*' --sort=-v:refversion | head -1`.
