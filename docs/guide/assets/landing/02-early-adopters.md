# 02 — Early Adopters

<!--
Тонкая полоса сразу после header, до Hero. Высота ~72px на desktop, auto на mobile.
Функция: заявить, что мы собираем реальные истории, и пригласить ранних пользователей связаться. Позиция выбрана сознательно по паттерну "logos strip right after nav" у современных dev-tool лендингов — когда появятся реальные команды, этот же слот превратится в logos strip + короткие цитаты, без реструктуризации страницы.

Desktop layout: одна центрированная строка:
  "Early adopters, we'd love to hear from you — [reach out →]"
  с лёгким тонированным фоном (чуть темнее hero) и узкими горизонтальными divider'ами сверху и снизу.

Mobile layout: две строки, текст и ссылка вертикально.

Визуально этот блок должен ощущаться как дополнение к header, а не полноценная секция — минимум padding, мелкий шрифт (~14px), без H2.
-->

## Content

**Single line (no heading):**

> Early adopters, we'd love to hear how Agloom is working for your team. [Reach out →](#)

<!--
Ссылка `Reach out →` — JS-обфускированный mailto на cusxies@gmail.com.

Реализация:

1. HTML-источник содержит placeholder без plaintext email:
   <a href="#" class="obfuscated-email" data-e="Y3VzeGllc0BnbWFpbC5jb20=">Reach out →</a>
   где data-e — base64 от "cusxies@gmail.com".

2. Inline-скрипт на странице:
   document.querySelectorAll('.obfuscated-email').forEach(a => {
     a.href = 'mailto:' + atob(a.dataset.e);
   });

3. Никаких plaintext email'ов нигде в HTML.
4. Текст ссылки ("Reach out →") не должен содержать email — иначе обфускация href бесполезна.

Современные scraper'ы научились парсить простые data-u/data-d паттерны, поэтому берём base64 + runtime decode. Реализация ~6 строк JS.
-->

## When this block evolves

Когда появятся первые команды, использующие Agloom в production, эта полоса превращается в logos strip (3-5 моно-логотипов по центру) с той же ссылкой `Reach out →`. Когда набирается достаточно цитат — добавляется под-блок с 2-3 короткими testimonial-цитатами, по-прежнему в пределах одной компактной секции. Этот план описан в Appendix B лендинг-спеки.
