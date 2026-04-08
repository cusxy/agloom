# 11 — CTA

<!--
Финальный CTA-блок, непосредственно перед футером. Функция: дать пользователю, который дочитал лендинг до конца, минимальное трение на старт. Без дополнительных объяснений.

Layout desktop: full-width banner, центрированное содержимое. Высота ~240px.
  - Headline сверху (H2)
  - Install chip под headline'ом (та же macOS-терминальная стилистика, что в Hero)
  - Две ссылки под install chip
Mobile: всё вертикально, install chip растягивается на полную ширину.
-->

## Content

**Headline (H2):**

> Install Agloom and try it on your project.

**Install chip (macOS-terminal styling, identical to Hero):**

<!--
Компонент в стилистике окна macOS-терминала:
  - Три dot'а сверху (#FF5F56 / #FFBD2E / #27C93F)
  - Тёмный фон (#1E1E1E), моноширинный шрифт
  - Иконка copy справа от команды, transient label "Copied ✓" при клике
-->

```bash
$ npm install -g agloom
```

**Links (inline below the chip):**

- `Read the docs →` → `/docs/getting-started`
- `View on GitHub →` → github repo
