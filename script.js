const MEGA_FOLDER_URL = "https://mega.nz/folder/zEtEyLCA#q1Z8g6GsFQ9742GkBZ_rwg";
const MANIFEST_URL = "tools.json";
const MEGAJS_URL = "https://unpkg.com/megajs/dist/main.browser-es.mjs";
const CACHE_KEY = "c9ber-hub-tools-v2";
const CACHE_TTL = 1000 * 60 * 20;

const exampleItems = [];

const state = {
  items: [],
  activeCategory: "All",
  searchTerm: ""
};

const cardsGrid = document.querySelector("#cards-grid");
const loadingState = document.querySelector("#loading-state");
const messageState = document.querySelector("#message-state");
const searchInput = document.querySelector("#search-input");
const categoryTabs = document.querySelectorAll(".category-tab");
const releaseCount = document.querySelector("#release-count");
const cacheStatus = document.querySelector("#cache-status");
const toast = document.querySelector("#toast");

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  initParticles();
  loadDownloads();
});

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderCards();
  });

  categoryTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      categoryTabs.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      state.activeCategory = tab.dataset.category;
      renderCards();
    });
  });
}

async function loadDownloads() {
  setLoading(true);
  showMessage("");

  const cached = readCache();
  if (cached) {
    state.items = mergeItems(cached.items, exampleItems);
    cacheStatus.textContent = "Loaded cached catalog while syncing";
    renderCards();
  }

  try {
    const liveItems = await loadLiveItems();
    writeCache(liveItems);

    state.items = mergeItems(liveItems, exampleItems);
    cacheStatus.textContent = getCacheStatusText(liveItems);
    renderCards();
  } catch (error) {
    console.error(error);
    if (!state.items.length && exampleItems.length) {
      state.items = exampleItems;
      renderCards();
    }
    if (!state.items.length) {
      releaseCount.textContent = "0 downloads indexed";
    }
    showMessage(`Could not sync MEGA right now. ${error.message || "Check the folder link and sharing settings."}`);
    cacheStatus.textContent = "MEGA sync unavailable";
  } finally {
    setLoading(false);
  }
}

async function loadLiveItems() {
  if (MEGA_FOLDER_URL.trim()) {
    return loadMegaFolderItems(MEGA_FOLDER_URL.trim());
  }

  const manifestItems = await loadManifestItems();
  if (manifestItems.length) {
    return manifestItems;
  }

  throw new Error("Add a MEGA_FOLDER_URL or tools.json entries to enable live downloads.");
}

async function loadMegaFolderItems(folderUrl) {
  const { File: MegaFile } = await import(MEGAJS_URL);
  const folderInfo = parseMegaFolderUrl(folderUrl);
  const folder = MegaFile.fromURL(folderUrl);

  await folder.loadAttributes();

  const children = Array.isArray(folder.children) ? folder.children : [];
  const files = await collectMegaFiles(children);
  const items = await Promise.all(files.map((file) => megaFileToItem(file, folderInfo)));

  return items.filter(Boolean);
}

async function collectMegaFiles(files, path = "") {
  const collected = [];

  for (const file of files) {
    const name = file.name || file.attributes?.name || "Download";
    const nextPath = path ? `${path}/${name}` : name;
    const isDirectory = file.directory || file.type === 1;

    if (isDirectory) {
      if (Array.isArray(file.children)) {
        collected.push(...(await collectMegaFiles(file.children, nextPath)));
      }
    } else {
      collected.push({ file, path: nextPath });
    }
  }

  return collected;
}

async function megaFileToItem(entry, folderInfo) {
  const { file, path } = entry;
  const fileName = file.name || file.attributes?.name || path.split("/").pop() || "Download";
  const link = await getMegaFileLink(file, folderInfo);

  if (!link) return null;

  return {
    id: file.nodeId || file.downloadId || link,
    title: makeTitle(fileName, ""),
    description: makeDescription(fileName, ""),
    version: parseVersion(fileName),
    size: formatBytes(file.size || file.attributes?.size || 0),
    downloadUrl: link,
    publishedAt: "MEGA folder",
    category: categorizeAsset(fileName),
    downloads: "MEGA",
    source: path
  };
}

async function getMegaFileLink(file, folderInfo) {
  if (Array.isArray(file.downloadId) && folderInfo.id && folderInfo.key) {
    const nodeId = file.downloadId[1] || file.nodeId;
    return `https://mega.nz/folder/${folderInfo.id}#${folderInfo.key}/file/${nodeId}`;
  }

  if (file.nodeId && folderInfo.id && folderInfo.key) {
    return `https://mega.nz/folder/${folderInfo.id}#${folderInfo.key}/file/${file.nodeId}`;
  }

  if (typeof file.link === "function") {
    return file.link();
  }

  if (file.downloadId && file.key) {
    return `https://mega.nz/file/${file.downloadId}#${file.key}`;
  }

  return file.url || file.link || "";
}

function parseMegaFolderUrl(folderUrl) {
  const url = new URL(folderUrl);
  const folderMatch = url.pathname.match(/\/folder\/([^/]+)/);
  const legacyParts = url.hash.split("!");

  if (folderMatch) {
    return {
      id: folderMatch[1],
      key: url.hash.slice(1).split("/")[0]
    };
  }

  if (legacyParts[0] === "#F") {
    return {
      id: legacyParts[1] || "",
      key: legacyParts[2] || ""
    };
  }

  throw new Error("MEGA folder link must look like https://mega.nz/folder/FOLDER_ID#FOLDER_KEY");
}

async function loadManifestItems() {
  const response = await fetch(MANIFEST_URL, { cache: "no-cache" });
  if (!response.ok) return [];

  const manifest = await response.json();
  const tools = Array.isArray(manifest) ? manifest : manifest.tools;

  if (!Array.isArray(tools)) return [];

  return tools
    .filter((tool) => tool && tool.url)
    .map((tool, index) => normalizeManifestItem(tool, index));
}

function normalizeManifestItem(tool, index) {
  const title = tool.title || makeTitle(fileNameFromUrl(tool.url), "");
  return {
    id: tool.id || `manifest-${index}-${tool.url}`,
    title,
    description: tool.description || makeDescription(title, ""),
    version: tool.version || parseVersion(title),
    size: tool.size || "Unknown",
    downloadUrl: tool.url,
    publishedAt: tool.publishedAt || "Manual link",
    category: tool.category || categorizeAsset(title),
    downloads: tool.downloads || "MEGA",
    source: tool.source || "tools.json"
  };
}

function getCacheStatusText(items) {
  const hasMegaFolder = MEGA_FOLDER_URL.trim();
  if (hasMegaFolder) return `Synced ${items.length} files from MEGA`;
  return `Loaded ${items.length} tools from manifest`;
}

function makeTitle(assetName, releaseName) {
  const cleaned = assetName
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (releaseName && cleaned && releaseName !== cleaned) {
    return `${releaseName} - ${cleaned}`;
  }
  return releaseName || cleaned || "Download";
}

function makeDescription(assetName, releaseBody) {
  const category = categorizeAsset(assetName).toLowerCase();
  const body = stripMarkdown(releaseBody || "");
  if (body) {
    return body.length > 118 ? `${body.slice(0, 115)}...` : body;
  }
  return `MEGA ${category.slice(0, -1) || "file"} ready for direct download.`;
}

function stripMarkdown(value) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categorizeAsset(name) {
  const lower = name.toLowerCase();
  const extension = lower.split(".").pop();

  if (extension === "apk" || lower.includes("android")) return "APKs";
  if (["sh", "bat", "ps1", "py", "js", "cmd"].includes(extension)) return "Scripts";
  if (["exe", "msi", "dmg", "pkg", "appimage", "deb", "rpm"].includes(extension)) return "Tools";
  return "Files";
}

function parseVersion(name) {
  const version = String(name).match(/(?:v|version[-_\s]*)?(\d+(?:\.\d+){1,3})/i);
  return version ? version[1] : "latest";
}

function fileNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const lastPart = parsed.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(lastPart || "Download");
  } catch (error) {
    return "Download";
  }
}

function mergeItems(apiItems, fallbackItems) {
  const seen = new Set(apiItems.map((item) => item.downloadUrl));
  return [
    ...apiItems,
    ...fallbackItems.filter((item) => !seen.has(item.downloadUrl))
  ];
}

function renderCards() {
  const filtered = getFilteredItems();
  releaseCount.textContent = `${state.items.length} downloads indexed`;

  cardsGrid.innerHTML = "";

  if (!filtered.length) {
    showMessage("No downloads match your current search.");
    return;
  }

  if (!loadingState.classList.contains("hidden")) {
    showMessage("");
  } else {
    showMessage("");
  }

  filtered.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "download-card";
    card.style.animationDelay = `${Math.min(index * 45, 450)}ms`;
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-top">
          <div class="file-icon" aria-hidden="true">${getIcon(item.category)}</div>
          <span class="category-badge">${escapeHtml(item.category)}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="description">${escapeHtml(item.description)}</p>
        <div class="meta-grid">
          <div class="meta-item">
            <span>Version</span>
            <strong title="${escapeHtml(item.version)}">${escapeHtml(item.version)}</strong>
          </div>
          <div class="meta-item">
            <span>Size</span>
            <strong>${escapeHtml(item.size)}</strong>
          </div>
          <div class="meta-item">
            <span>Published</span>
            <strong>${escapeHtml(item.publishedAt)}</strong>
          </div>
          <div class="meta-item">
            <span>Downloads</span>
            <strong>${escapeHtml(item.downloads)}</strong>
          </div>
        </div>
        <div class="card-actions">
          <a class="download-button" href="${escapeAttribute(item.downloadUrl)}" download rel="noreferrer">Download</a>
          <button class="copy-button" type="button" data-copy="${escapeAttribute(item.downloadUrl)}" aria-label="Copy download link">URL</button>
        </div>
      </div>
    `;
    cardsGrid.appendChild(card);
  });

  cardsGrid.querySelectorAll(".copy-button").forEach((button) => {
    button.addEventListener("click", () => copyLink(button.dataset.copy));
  });
}

function getFilteredItems() {
  return state.items.filter((item) => {
    const categoryMatch = state.activeCategory === "All" || item.category === state.activeCategory;
    const searchable = `${item.title} ${item.description} ${item.version} ${item.category} ${item.source}`.toLowerCase();
    return categoryMatch && searchable.includes(state.searchTerm);
  });
}

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast("Download link copied.");
  } catch (error) {
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast("Download link copied.");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function setLoading(isLoading) {
  loadingState.classList.toggle("hidden", !isLoading);
}

function showMessage(message) {
  messageState.textContent = message;
  messageState.classList.toggle("hidden", !message);
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached.createdAt || Date.now() - cached.createdAt > CACHE_TTL) return null;
    return cached;
  } catch (error) {
    return null;
  }
}

function writeCache(items) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      createdAt: Date.now(),
      items
    }));
  } catch (error) {
    console.warn("Unable to write release cache", error);
  }
}

function formatBytes(bytes = 0) {
  if (!bytes) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function getIcon(category) {
  const icons = {
    Tools: "EXE",
    APKs: "APK",
    Scripts: "{ }",
    Files: "FILE"
  };
  return icons[category] || "FILE";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function initParticles() {
  const canvas = document.querySelector("#particle-canvas");
  const context = canvas.getContext("2d");
  const particles = [];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let animationFrame = null;

  function resize() {
    width = canvas.width = window.innerWidth * window.devicePixelRatio;
    height = canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    createParticles();
  }

  function createParticles() {
    particles.length = 0;
    const count = reducedMotion ? 18 : Math.min(80, Math.floor(window.innerWidth / 18));
    for (let index = 0; index < count; index += 1) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: (Math.random() * 1.6 + 0.6) * window.devicePixelRatio,
        speedX: (Math.random() - 0.5) * 0.26 * window.devicePixelRatio,
        speedY: (Math.random() - 0.5) * 0.26 * window.devicePixelRatio,
        color: Math.random() > 0.5 ? "97, 255, 228" : "255, 79, 216"
      });
    }
  }

  function draw() {
    context.clearRect(0, 0, width, height);

    particles.forEach((particle, index) => {
      particle.x += particle.speedX;
      particle.y += particle.speedY;

      if (particle.x < 0 || particle.x > width) particle.speedX *= -1;
      if (particle.y < 0 || particle.y > height) particle.speedY *= -1;

      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(${particle.color}, 0.72)`;
      context.fill();

      for (let nextIndex = index + 1; nextIndex < particles.length; nextIndex += 1) {
        const other = particles[nextIndex];
        const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
        if (distance < 130 * window.devicePixelRatio) {
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = `rgba(97, 255, 228, ${0.13 - distance / (1300 * window.devicePixelRatio)})`;
          context.lineWidth = 1 * window.devicePixelRatio;
          context.stroke();
        }
      }
    });

    animationFrame = window.requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.cancelAnimationFrame(animationFrame);
    } else {
      draw();
    }
  });
}
