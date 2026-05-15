const REPO_OWNER = "C9ber99";
const REPO_NAME = "hub";
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
const CACHE_KEY = "c9ber-hub-releases-v1";
const CACHE_TTL = 1000 * 60 * 20;

const exampleItems = [
  {
    id: "example-rustdesk-apk",
    title: "RustDesk",
    description: "Remote desktop software",
    version: "0.1",
    size: "Release asset",
    downloadUrl: "https://github.com/C9ber99/hub/releases/download/0.1/rustdesk-1.4.6-universal-signed.apk",
    publishedAt: "Example",
    category: "APKs",
    downloads: "Live soon",
    source: "Example"
  },
  {
    id: "example-root-file",
    title: "Root File Example",
    description: "Repository file download example",
    version: "main",
    size: "Repository file",
    downloadUrl: "https://github.com/C9ber99/hub/raw/main/rustdesk-1.4.6-x86_64.exe",
    publishedAt: "Example",
    category: "Tools",
    downloads: "Live soon",
    source: "Example"
  }
];

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
    const response = await fetch(API_URL, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const releases = await response.json();
    const releaseItems = parseReleaseAssets(releases);
    writeCache(releaseItems);

    state.items = mergeItems(releaseItems, exampleItems);
    cacheStatus.textContent = "Synced from GitHub Releases";
    renderCards();
  } catch (error) {
    console.error(error);
    if (!state.items.length) {
      state.items = exampleItems;
      renderCards();
    }
    showMessage("Could not reach GitHub Releases right now. Showing cached and example downloads.");
    cacheStatus.textContent = "GitHub API unavailable";
  } finally {
    setLoading(false);
  }
}

function parseReleaseAssets(releases) {
  return releases.flatMap((release) => {
    const assets = Array.isArray(release.assets) ? release.assets : [];

    return assets.map((asset) => {
      const assetName = asset.name || "Download asset";
      return {
        id: `${release.id}-${asset.id}`,
        title: makeTitle(assetName, release.name || release.tag_name),
        description: makeDescription(assetName, release.body),
        version: release.tag_name || "latest",
        size: formatBytes(asset.size),
        downloadUrl: asset.browser_download_url,
        publishedAt: formatDate(release.published_at || release.created_at),
        category: categorizeAsset(assetName),
        downloads: formatNumber(asset.download_count || 0),
        source: release.name || release.tag_name || "GitHub Release"
      };
    });
  });
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
  return `GitHub release ${category.slice(0, -1) || "file"} ready for direct download.`;
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
