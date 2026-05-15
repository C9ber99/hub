# C9ber Hub

Modern dark-themed personal download hub for GitHub Pages. It is fully static and automatically loads uploaded assets from GitHub Releases.

## Files

- `index.html` - page structure
- `style.css` - cyberpunk glass UI and responsive layout
- `script.js` - GitHub Releases API loading, caching, search, categories, copy link toasts, and particles
- `assets/favicon.svg` - favicon

## Enable GitHub Pages

1. Push these files to `https://github.com/C9ber99/hub`.
2. Open the repository on GitHub.
3. Go to **Settings**.
4. Open **Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and the `/root` folder.
7. Save.
8. Visit the GitHub Pages URL shown by GitHub after deployment finishes.

## Add Downloads With Releases

1. Open the repository on GitHub.
2. Go to **Releases**.
3. Click **Draft a new release**.
4. Create a tag such as `0.2`, `v1.0.0`, or any version you prefer.
5. Add a release title and notes.
6. Upload one or more files as release assets.
7. Publish the release.

The website fetches:

- release title
- release tag/version
- uploaded asset name
- asset size
- direct download URL
- publish date
- asset download count

New release assets appear automatically without editing `index.html`.

## Categories

Categories are detected from file names and extensions:

- APKs: `.apk` or names containing `android`
- Scripts: `.sh`, `.bat`, `.ps1`, `.py`, `.js`, `.cmd`
- Tools: `.exe`, `.msi`, `.dmg`, `.pkg`, `.appimage`, `.deb`, `.rpm`
- Files: everything else

## Caching

The site uses `localStorage` to cache release data for 20 minutes. This makes repeat visits faster and gives visitors a fallback if the GitHub API is temporarily unavailable.

## Customize Styles

Edit `style.css`.

Useful variables are at the top of the file:

- `--bg`
- `--panel`
- `--text`
- `--muted`
- `--cyan`
- `--lime`
- `--pink`
- `--radius`

## Customize Repository

If you fork or rename the repository, update these constants at the top of `script.js`:

```js
const REPO_OWNER = "C9ber99";
const REPO_NAME = "hub";
```

## Direct Repository File Downloads

Release assets are recommended because they provide stable download URLs and download counts. You can also link to repository files with raw GitHub URLs, like:

```text
https://github.com/C9ber99/hub/raw/main/rustdesk-1.4.6-x86_64.exe
```

The included example items show both a release asset and a root repository file download.

## No Backend Required

This project uses only HTML, CSS, and JavaScript. It works on GitHub Pages and does not require React, Vue, a build step, a server, or a database.
