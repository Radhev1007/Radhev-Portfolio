# Suisse Int'l

**Not included.** Suisse Int'l is a commercial typeface from Swiss Typefaces
and cannot be committed to this repository. Until licensed files are added
here, the site renders in Arial / Helvetica — see `--font-sans` in
`styles/globals.css`.

## To enable

1. Buy a webfont licence and export woff2 files.
2. Place them here with these exact names:

   - `SuisseIntl-Regular.woff2` (400)
   - `SuisseIntl-Medium.woff2` (500)
   - `SuisseIntl-Bold.woff2` (700)

3. Uncomment the `@font-face` block at the top of `styles/globals.css`.

Nothing else needs changing — the stack already names `"Suisse Intl"` first.

## Checking it worked

Load the site and run this in the console; it should report `Suisse Intl`,
not `Arial`:

```js
getComputedStyle(document.querySelector("h1")).fontFamily
```
