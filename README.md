# Sailing Upwind Tactics Simulator

A single-page web app for one race-day question: **which side of the upwind beat pays?**

Set up the course (start line length and skew, windward mark), the wind (mean direction, oscillation phases, speed), up to four current measurements and a boat polar. The app simulates the boat to the mark going left (starting at the pin end) and going right (starting at the committee-boat end) under three wind scenarios and compares the elapsed times. The chart shows the simulated ground tracks, the interpolated current field and the current-corrected laylines. Plain HTML/CSS/JS on a canvas — no build step, no dependencies, everything runs in the browser.

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

The version shown in the app header (`v1.<n> · <date>`) is the commit
count, written into `js/version.js` by a pre-commit hook. After cloning,
enable the hook once with:

```
git config core.hooksPath .githooks
```

User-facing changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Author & license

Created by **Stacey Szigeti** ([Fastrrr](https://fastrrr.com)).
Released under the [MIT License](LICENSE).
