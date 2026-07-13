# Sailing Upwind Tactics Simulator

A single-page web app for simulating upwind sailing tactics.

## Usage

Open `index.html` in a browser — no build step or dependencies required.

## Project structure

```
index.html      markup
css/style.css   styles
js/app.js       simulation, chart rendering, UI logic
js/version.js   generated build tag (do not edit by hand)
```

## Versioning

The version shown in the app header (`v0.<n> · <date>`) is the commit
count, written into `js/version.js` by a pre-commit hook. After cloning,
enable the hook once with:

```
git config core.hooksPath .githooks
```

User-facing changes are tracked in [CHANGELOG.md](CHANGELOG.md).
