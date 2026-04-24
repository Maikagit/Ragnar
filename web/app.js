// ═══ ÉLÉMENTS ═══
const viewCover    = document.getElementById("view-cover");
const viewBook     = document.getElementById("view-book");
const openBtn      = document.getElementById("open-btn");
const prevBtn      = document.getElementById("prev-btn");
const nextBtn      = document.getElementById("next-btn");
const contentLeft  = document.getElementById("content-left");
const contentRight = document.getElementById("content-right");
const pagenumLeft  = document.getElementById("pagenum-left");
const pagenumRight = document.getElementById("pagenum-right");
const headerLeft   = document.getElementById("header-left");
const headerRight  = document.getElementById("header-right");
const navInfo      = document.getElementById("nav-info");
const coverTitleEl = document.getElementById("cover-title");

// ═══ ÉTAT ═══
let chapters   = [];
let pages      = [];  // { chapterTitle, chapterIdx, isFirstOfChapter, html }
let bookTitle  = "";
let viewState  = "cover";  // "cover" | "single" | "spread"
let spreadLeft = 1;        // indice (0-based) dans pages[], page gauche en mode spread

// ═══ CHARGEMENT ═══
async function loadStory() {
  const candidates = ["../content/story.md", "/content/story.md", "./content/story.md"];
  let md = "";

  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        md = await res.text();
        break;
      }
    } catch {
      // essayer le suivant
    }
  }

  if (!md) {
    contentRight.innerHTML = "<p style='color:#a00'>Impossible de charger content/story.md</p>";
    return;
  }

  const parsed = parseMarkdown(md);
  bookTitle = parsed.bookTitle || "Les Chroniques de Ragnard";
  chapters  = parsed.chapters;

  coverTitleEl.textContent = bookTitle;
  document.title = bookTitle;

  pages = paginateAllChapters();
}

// ═══ PARSING ═══
function parseMarkdown(md) {
  const lines    = md.replace(/\r/g, "").split("\n");
  let bTitle     = "";
  const sections = [];
  let current    = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith("# ") && !bTitle) {
      bTitle = line.slice(2).trim();
      continue;
    }

    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { title: line.slice(3).trim(), lines: [] };
      continue;
    }

    if (current) current.lines.push(raw);
  }

  if (current) sections.push(current);
  return { bookTitle: bTitle, chapters: sections };
}

// ═══ PAGINATION ═══
function createProbe() {
  // Élément fantôme hors-écran qui reproduit la mise en page d'une vraie page
  // pour mesurer exactement combien de paragraphes tiennent dans la zone de texte.
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;";

  const page = document.createElement("div");
  page.className = "page page-right";

  const header = document.createElement("div");
  header.className = "page-header";
  header.textContent = bookTitle;

  const content = document.createElement("div");
  content.className = "page-content";
  content.style.overflowY = "hidden";

  const footer = document.createElement("div");
  footer.className = "page-footer";
  footer.innerHTML = '<span class="page-number">— 1 —</span>';

  page.appendChild(header);
  page.appendChild(content);
  page.appendChild(footer);
  wrapper.appendChild(page);
  document.body.appendChild(wrapper);

  return { wrapper, content };
}

function paginateAllChapters() {
  const { wrapper, content: probe } = createProbe();
  const allPages = [];

  chapters.forEach((ch, chIdx) => {
    const chPages = paginateChapter(ch, probe);
    chPages.forEach((html, i) => {
      allPages.push({
        chapterTitle:      ch.title,
        chapterIdx,
        isFirstOfChapter:  i === 0,
        html,
      });
    });
  });

  document.body.removeChild(wrapper);
  return allPages;
}

function paginateChapter(ch, probe) {
  const paraList   = buildParagraphHtmlList(ch.lines);
  const resultPages = [];
  let currentParts  = [];
  let firstPage     = true;

  const flush = () => {
    resultPages.push(currentParts.join(""));
    currentParts = [];
  };

  const resetProbe = (withTitle) => {
    probe.innerHTML = withTitle
      ? `<h2 class="chapter-title">${escHtml(ch.title)}</h2>`
      : "";
  };

  resetProbe(true);

  for (const pHtml of paraList) {
    probe.insertAdjacentHTML("beforeend", pHtml);

    if (probe.scrollHeight > probe.clientHeight) {
      // Ce paragraphe fait déborder la page — on le retire et on coupe ici.
      probe.removeChild(probe.lastElementChild);

      if (currentParts.length > 0) {
        flush();
        firstPage = false;
        resetProbe(false);
        probe.insertAdjacentHTML("beforeend", pHtml);
        currentParts.push(pHtml);
      } else {
        // Paragraphe seul trop long — on le force quand même sur cette page.
        currentParts.push(pHtml);
        flush();
        firstPage = false;
        resetProbe(false);
      }
    } else {
      currentParts.push(pHtml);
    }
  }

  if (currentParts.length > 0) flush();
  return resultPages.length > 0 ? resultPages : [""];
}

// ═══ RENDU ═══
function showCover() {
  viewState = "cover";
  viewCover.classList.remove("hidden");
  viewBook.classList.add("hidden");
}

function showSingle() {
  viewState = "single";
  viewCover.classList.add("hidden");
  viewBook.classList.remove("hidden");

  setInsideCover(contentLeft, headerLeft, pagenumLeft);
  setPageContent(contentRight, headerRight, pagenumRight, 0);

  updateNav();
}

function showSpread(leftIdx) {
  viewState  = "spread";
  spreadLeft = leftIdx;
  viewCover.classList.add("hidden");
  viewBook.classList.remove("hidden");

  setPageContent(contentLeft, headerLeft, pagenumLeft, leftIdx);

  const rightIdx = leftIdx + 1;
  if (rightIdx < pages.length) {
    setPageContent(contentRight, headerRight, pagenumRight, rightIdx);
  } else {
    setDecoPage(contentRight, headerRight, pagenumRight);
  }

  updateNav();
}

function setInsideCover(contentEl, headerEl, pagenumEl) {
  headerEl.textContent  = "";
  pagenumEl.textContent = "";
  contentEl.innerHTML = `
    <div class="inside-cover">
      <div class="ic-rule"></div>
      <div class="ic-ornament">⚔</div>
      <div class="ic-title">${escHtml(bookTitle)}</div>
      <div class="ic-rule"></div>
    </div>`;
}

function setDecoPage(contentEl, headerEl, pagenumEl) {
  headerEl.textContent  = "";
  pagenumEl.textContent = "";
  contentEl.innerHTML   = `<div class="inside-cover"><div class="ic-ornament">✦</div></div>`;
}

function setPageContent(contentEl, headerEl, pagenumEl, idx) {
  const pg  = pages[idx];
  const num = idx + 1;

  headerEl.textContent  = bookTitle;
  pagenumEl.textContent = `— ${num} —`;

  let html = "";
  if (pg.isFirstOfChapter) {
    html += `<h2 class="chapter-title">${escHtml(pg.chapterTitle)}</h2>`;
  }
  html += `<div class="prose">${pg.html}</div>`;
  contentEl.innerHTML = html;
}

// ═══ PROSE ═══
function buildParagraphHtmlList(lines) {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map(toParagraph);
}

function toParagraph(line) {
  const esc = escHtml(line);

  if (line === "—") {
    return `<p class="section-break">* * *</p>`;
  }

  if (line.startsWith("Chapitre ")) {
    return `<p class="sub-heading"><strong>${esc}</strong></p>`;
  }

  if (line.startsWith("—") || line.startsWith('"')) {
    return `<p class="dialogue">${esc}</p>`;
  }

  return `<p>${esc}</p>`;
}

function escHtml(t) {
  return t
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ═══ NAVIGATION ═══
function hasNext() {
  if (viewState === "cover")  return pages.length > 0;
  if (viewState === "single") return pages.length > 1;
  return spreadLeft + 2 < pages.length;
}

function hasPrev() {
  return viewState !== "cover";
}

function goNext() {
  if (viewState === "cover")       showSingle();
  else if (viewState === "single") showSpread(1);
  else                             showSpread(spreadLeft + 2);
}

function goPrev() {
  if (viewState === "single")                           showCover();
  else if (viewState === "spread" && spreadLeft === 1)  showSingle();
  else                                                  showSpread(spreadLeft - 2);
}

function updateNav() {
  prevBtn.disabled = !hasPrev();
  nextBtn.disabled = !hasNext();

  if (viewState === "single") {
    navInfo.textContent = "Page 1";
  } else {
    const r = spreadLeft + 1;
    navInfo.textContent = r < pages.length
      ? `Pages ${spreadLeft + 1} — ${r + 1}`
      : `Page ${spreadLeft + 1}`;
  }
}

// ═══ ÉVÉNEMENTS ═══
openBtn.addEventListener("click", showSingle);
prevBtn.addEventListener("click", goPrev);
nextBtn.addEventListener("click", goNext);

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") goNext();
  if (e.key === "ArrowLeft")  goPrev();
});

loadStory();

