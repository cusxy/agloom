# 01 — Header

<!--
Non-sticky. Высота ~64px. Простая горизонтальная полоса, скроллится вместе со страницей.

Desktop layout: [logo + wordmark] ........................ [subtitle kicker]
Mobile layout:  [logo + wordmark]  (kicker скрыт на ≤640px — не помещается и не несёт
                                    новой информации на маленьких экранах)

Никакой primary CTA-кнопки и никаких nav-ссылок в header'е — GitHub и Getting Started
живут дальше по лендингу (Source on GitHub / Read the docs → в Hero + повторно в
финальном CTA-блоке). Header сознательно «плоский» — просто wordmark и tagline.
-->

## Content

**Logo + wordmark:** `Agloom` (foggy-oo lockup, см. `docs/design/logo-brief.md`).

- Название проекта пишется с большой буквы: `Agloom`.
- Лого и wordmark в header'е **не интерактивны** — пользователь уже находится на главной странице, поэтому ссылка на `/` не нужна. Визуально это плоская пара «иконка + слово», без cursor:pointer и без hover-эффектов.

**Kicker (right-aligned subtitle):**

> Canonical Config · Transpiler for AI coding agents

Моноширинный, xxs размер, uppercase, muted цвет, выравнивание по правому краю.
Функция — мгновенно объяснить читателю «что это такое», без необходимости
спускаться в hero. На mobile (`≤640px`) kicker скрывается, чтобы не конкурировать
с wordmark за ширину полосы.
