---
summary: CI-валидация документации и deploy на Cloudflare Pages при релизе
description: >
  Расширение GitHub Actions CI (валидация docs linked list, сборка Docusaurus)
  и добавление deploy Docusaurus-сайта на Cloudflare Pages в release workflow
  при публикации v*-тега.
type: spec
status: implemented
relates:
  - docs/specs/docusaurus-setup.md
  - docs/specs/help-command.md
maps_to:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
---

# CI-валидация документации и deploy на Cloudflare Pages

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация описывает расширение существующих GitHub Actions workflows:
добавление валидации документации и сборки Docusaurus в CI, а также deploy
документационного сайта на Cloudflare Pages в release workflow.

Настройка Docusaurus и Cloudflare Pages project описана
в `docs/specs/docusaurus-setup.md` и не входит в scope данной спецификации.

Скрипт `validate-docs-linked-list.ts` описан в `docs/specs/help-command.md`
и не входит в scope данной спецификации.

## Изменения в CI workflow (.github/workflows/ci.yml)

### Триггеры и структура

Триггеры (`on`), `concurrency` и job `ci` с матрицей Node.js-версий
НЕ ДОЛЖНЫ быть изменены.

### Новые steps

В job `ci` ТРЕБУЕТСЯ добавить два step после `pnpm install --frozen-lockfile`
и перед `pnpm run build`:

1. **Validate docs linked list** — `run: npx tsx scripts/validate-docs-linked-list.ts`.
   Step ДОЛЖЕН располагаться после `pnpm install --frozen-lockfile`,
   потому что скрипт зависит от установленных пакетов.
2. **Build Docusaurus site** — `run: cd website && pnpm run build:site`.
   Step ДОЛЖЕН располагаться после validate docs linked list.

### Порядок steps после изменения

Итоговый порядок steps в job `ci` ДОЛЖЕН быть:

1. `actions/checkout@v4`
2. `pnpm/action-setup@v4`
3. `actions/setup-node@v4` (с матрицей `node-version` и `cache: pnpm`)
4. `pnpm install --frozen-lockfile`
5. `npx tsx scripts/validate-docs-linked-list.ts`
6. `cd website && pnpm run build:site`
7. `pnpm run build`
8. `pnpm run lint`
9. `pnpm run fmt:check`
10. `pnpm run test`

## Изменения в Release workflow (.github/workflows/release.yml)

### Триггеры и permissions

Триггер (`on: push: tags: ["v*"]`) НЕ ДОЛЖЕН быть изменён.

В секцию `permissions` ТРЕБУЕТСЯ добавить `deployments: write`,
потому что Cloudflare Pages deploy создает GitHub deployment status.
Итоговые permissions ДОЛЖНЫ быть:

```yaml
permissions:
  contents: read
  id-token: write
  deployments: write
```

### Job publish

Существующий job `publish` НЕ ДОЛЖЕН быть изменён. Все steps
(checkout, pnpm setup, node setup, install, build, test, publish)
ДОЛЖНЫ остаться без изменений.

### Новый job deploy

ТРЕБУЕТСЯ добавить job `deploy` со следующими характеристиками:

- `needs: publish` — job ДОЛЖЕН выполняться только после успешного
  завершения job `publish`.
- `runs-on: ubuntu-latest`.
- `name: Deploy Docs`.

Steps job `deploy` ДОЛЖНЫ быть:

1. `actions/checkout@v4`
2. `pnpm/action-setup@v4`
3. `actions/setup-node@v4` с `node-version: 22` и `cache: pnpm`
4. `pnpm install --frozen-lockfile`
5. `cd website && pnpm run build:site` — сборка Docusaurus-сайта.
6. Deploy на Cloudflare Pages:

```yaml
- name: Deploy to Cloudflare Pages
  run: npx wrangler pages deploy website/build --project-name=agloom
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Step deploy ДОЛЖЕН использовать `npx wrangler` (не глобальную установку),
потому что wrangler устанавливается как transitive dependency через
workspace или загружается npx.

## GitHub Secrets

Для работы deploy ТРЕБУЕТСЯ настроить следующие GitHub repository secrets:

| Secret                  | Описание                                                | Существует |
| ----------------------- | ------------------------------------------------------- | ---------- |
| `CLOUDFLARE_API_TOKEN`  | API token Cloudflare с правами `Cloudflare Pages: Edit` | нет        |
| `CLOUDFLARE_ACCOUNT_ID` | ID аккаунта Cloudflare                                  | нет        |
| `NODE_AUTH_TOKEN`       | Token для npm publish (используется в job `publish`)    | да         |

`CLOUDFLARE_API_TOKEN` ДОЛЖЕН иметь минимальные необходимые права:
`Account > Cloudflare Pages > Edit`.

`CLOUDFLARE_ACCOUNT_ID` МОЖЕТ быть настроен как repository variable
(не secret), потому что Account ID не является секретным значением.

## Настройка Cloudflare Pages project

Cloudflare Pages project ДОЛЖЕН быть настроен для режима Direct Upload
(не Git integration), потому что deploy выполняется через GitHub Actions
с помощью `wrangler pages deploy`.

Нативная GitHub-интеграция Cloudflare Pages ДОЛЖНА быть отключена
(или не подключена), чтобы избежать дублирования deploy.

- **Project name** — `agloom`.
- **Production branch** — не применимо (Direct Upload).
- **Custom domains** — `agloom.sh`, `docs.agloom.sh`
  (описаны в `docs/specs/docusaurus-setup.md`).

## Вне scope

- Настройка Docusaurus, структура `website/`, конфигурация Cloudflare Pages
  domains и redirects — описаны в `docs/specs/docusaurus-setup.md`.
- Скрипт `validate-docs-linked-list.ts` — описан в `docs/specs/help-command.md`.
- Preview deploys для Pull Requests — не требуются.
- Deploy на каждый push в main — документация ДОЛЖНА соответствовать
  опубликованной npm-версии, поэтому deploy выполняется только при релизе.
- Настройка Cloudflare API token и Account ID — ручная операция
  в Cloudflare Dashboard и GitHub Settings.
