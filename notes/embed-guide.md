# Standalone & Slide Embedding Guide (`embed/*.html`)

Every built application in `postrank Explorer` is generated as a self-contained standalone HTML page in `embed/<name>.html` (adapted for the published tree at `docs/embed/<name>.html`). Standalone pages use classic scripts only, make zero external network requests, and run identically over HTTPS, `http://localhost`, and offline `file://` archives.

## 1. URL Parameters

| Parameter | Purpose | Example |
|---|---|---|
| `preset=<id>` | Opens a named catalog preset | `?preset=tau40` |
| `<key>=<value>` | Sets one or more public state controls directly | `?tau=.20&w=.8` |
| `open=<box>` | Opens named progressive disclosures at mount (`data`, `method`, `settings`) | `?open=data` |
| `theme=light\|dark\|system` | Selects fixed colors or follows the operating system | `?theme=dark` |
| `hide=<parts>` | Hides outer embed chrome for tight slide frames (`chrome`, `title`, `caption`, `presets`, `disclosures`) | `?hide=chrome` |

- `hide=chrome` is shorthand for `hide=title,caption` (keeping interactive controls, presets, live readout, figure stage, and required source/license credits visible).
- Reserved host parameters (`preset`, `theme`, `open`, `hide`) never alter or pollute the mathematical state of the widget, and `hide` never suppresses required dataset license credits.

Full website pages render in light mode so surrounding prose, tables, callouts, and navigation remain consistent regardless of operating-system settings. Standalone pages (`embed/*.html`) follow the operating system's appearance by default, or accept an explicit `?theme=light`, `?theme=dark`, or `?theme=system` query parameter.

**Open full page** and the app page's **Open standalone** link carry the active preset and representable public control settings in either direction. This includes manually changed settings, even when no preset matches. Slide-only display settings such as `hide` apply to the current view. In T.1, a handoff with local input opens the settings and asks for the records again. Pasted data and draft text stay in the current component.

In a source checkout, standalone pages use the rendered full pages under `docs/pages/`. A standalone copied inside the rendered site links to its neighboring `pages/` directory. Both forms work over HTTP or from a local copy.

## 2. Embedding in Quarto / Reveal.js Slides

```html
<iframe
  src="https://joonho112.github.io/postrank-explorer/embed/frontier.html?preset=tau40&theme=light&hide=chrome"
  width="100%"
  height="560"
  style="border: 0; border-radius: 8px;"
  loading="lazy"
  title="2.10 The error-disclosure frontier">
</iframe>
```

For offline talks, point `src` to a local copy of the rendered `docs/` directory (for example `docs/embed/frontier.html?preset=tau40&hide=chrome`).

## 3. PostMessage Control from a Host Page

A parent frame or Reveal.js slide deck can update an embedded app's state without reloading the `<iframe>` by posting `{ prx: { ...partialState } }`:

```js
iframe.contentWindow.postMessage({ prx: { tau: 0.25 } }, "*");
```

Only allow-listed keys of that application are applied, and keyboard focus stays in the host slide until the viewer clicks or tabs into the frame.

## 4. Data & License Attribution

Every `embed/<name>.html` footer displays `Open full page` alongside the required license and source notices from `data/released/data_contract.json`. Under all `?hide=` modes (`?hide=chrome` or any combination of `title,caption,presets,disclosures`), `.prx-embed-credit` remains visible (`credit` cannot be hidden). In lecture slides or handouts, also include full bibliographic citations for any empirical dataset shown (e.g., Kline, Rose and Walters 2024; California Department of Education; Opportunity Insights & U.S. Census Bureau).
