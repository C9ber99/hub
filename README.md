# C9ber Hub

Modern dark-themed personal download hub for GitHub Pages. It is fully static and can load tools from a shared MEGA folder or from a simple `tools.json` catalog.

## Files

- `index.html` - page structure
- `style.css` - cyberpunk glass UI and responsive layout
- `script.js` - MEGA folder sync, `tools.json` loading, caching, search, categories, copy link toasts, and particles
- `tools.json` - optional manual catalog for MEGA links or any direct download URLs
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

## Recommended MEGA Workflow

1. Create a folder in MEGA, for example `C9ber Hub Tools`.
2. Upload your `.exe`, `.apk`, scripts, zip files, and other tools into that folder.
3. Share the folder and copy the public MEGA folder link.
4. Open `script.js`.
5. Paste the folder link into `MEGA_FOLDER_URL`:

```js
const MEGA_FOLDER_URL = "https://mega.nz/folder/YOUR_FOLDER_ID#YOUR_FOLDER_KEY";
```

6. Push the updated site to GitHub Pages.

When you add files to the shared MEGA folder, the website will scan that folder and show downloadable cards automatically.

## What MEGA Sync Reads

The website reads public/shared MEGA folder data:

- file name
- asset size
- public MEGA download link
- nested folder path
- category based on extension
- version guessed from file name, for example `tool-1.2.0.exe`

No MEGA account password is stored in the website. Do not put your MEGA email, password, or session keys in frontend JavaScript.

## Manual Link Fallback

If you do not want to use public folder scanning, edit `tools.json` and add MEGA file links manually:

```json
{
  "tools": [
    {
      "title": "My Tool",
      "description": "Short description",
      "version": "1.0.0",
      "size": "25 MB",
      "category": "Tools",
      "url": "https://mega.nz/file/..."
    }
  ]
}
```

This is also useful if MEGA changes folder behavior or if you want tighter control over titles and descriptions.

## Categories

Categories are detected from file names and extensions:

- APKs: `.apk` or names containing `android`
- Scripts: `.sh`, `.bat`, `.ps1`, `.py`, `.js`, `.cmd`
- Tools: `.exe`, `.msi`, `.dmg`, `.pkg`, `.appimage`, `.deb`, `.rpm`
- Files: everything else

## Caching

The site uses `localStorage` to cache catalog data for 20 minutes. This makes repeat visits faster and gives visitors a fallback if MEGA is temporarily unavailable.

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

## Customize MEGA Source

Update these constants at the top of `script.js`:

```js
const MEGA_FOLDER_URL = "";
const MANIFEST_URL = "tools.json";
```

Use `MEGA_FOLDER_URL` for automatic public MEGA folder sync. Use `MANIFEST_URL` if you prefer a JSON catalog.

## Direct Repository File Downloads

MEGA links are recommended for your tool storage. You can also link to repository files with raw GitHub URLs if you ever need to:

```text
https://github.com/C9ber99/hub/raw/main/rustdesk-1.4.6-x86_64.exe
```

The site no longer depends on GitHub Releases.

## No Backend Required

This project uses only HTML, CSS, and JavaScript. It works on GitHub Pages and does not require React, Vue, a build step, a server, or a database.

For public MEGA folder scanning, the frontend imports the MEGA JavaScript SDK from a CDN. If you want zero external JavaScript dependencies, use `tools.json` with direct MEGA links instead.
