// ═══════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════
const PAGE_W = 460;
const PAGE_H = 680;

// ═══════════════════════════════════════
// ÉLÉMENTS
// ═══════════════════════════════════════
const viewCover    = document.getElementById("view-cover");
const viewBook     = document.getElementById("view-book");
const openBtn      = document.getElementById("open-btn");
const closeBtn     = document.getElementById("close-btn");
const prevBtn      = document.getElementById("prev-btn");
const nextBtn      = document.getElementById("next-btn");
const navInfo      = document.getElementById("nav-info");
const coverTitleEl = document.getElementById("cover-title");
const bookFlip     = document.getElementById("book-flip");
const measureBox   = document.getElementById("measure");
const measureContent = measureBox.querySelector(".page-content");

// ═══════════════════════════════════════
// ÉTAT
// ═══════════════════════════════════════
let bookTitle = "";
let chapters  = [];
let pages     = [];   // [{ chapterTitle, html, isContinuation }]
let pageFlip  = null;

// ═══════════════════════════════════════
// BOOT
// ═══════════════════════════════════════
async function boot() {
  try {
    const md = await loadStoryMarkdown();
    const parsed = parseMarkdown(md);
    bookTitle = parsed.bookTitle || "Les Chroniques de Ragnard";
    chapters  = parsed.chapters;

    coverTitleEl.textContent = bookTitle;
    document.title = bookTitle;

    // Attendre que les polices soient chargées avant de mesurer
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    pages = paginateChapters(chapters);

    openBtn.textContent = "Ouvrir le livre";
    openBtn.disabled = false;
  } catch (err) {
    console.error("Erreur de chargement:", err);
    openBtn.textContent = "Erreur de chargement";
  }
}

async function loadStoryMarkdown() {
  const candidates = [
    "../content/story.md",
    "./content/story.md",
    "/content/story.md",
  ];
  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (res.ok) return await res.text();
    } catch {
      // try next
    }
  }
  throw new Error("Impossible de charger content/story.md");
}

// ═══════════════════════════════════════
// PARSING MARKDOWN
// ═══════════════════════════════════════
function parseMarkdown(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  let bTitle  = "";
  const result = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith("# ") && !bTitle) {
      bTitle = line.slice(2).trim();
      continue;
    }

    if (line.startsWith("## ")) {
      if (current) result.push(current);
      current = { title: line.slice(3).trim(), paragraphs: [] };
      continue;
    }

    if (current && line.length > 0) {
      current.paragraphs.push(line);
    }
  }

  if (current) result.push(current);
  return { bookTitle: bTitle, chapters: result };
}

function classifyParagraph(line) {
  if (line === "—" || line === "---" || line === "***") {
    return { type: "break" };
  }
  if (/^Chapitre\s/i.test(line)) {
    return { type: "subheading", text: line };
  }
  if (line.startsWith("—") || line.startsWith("\"") ||
      line.startsWith("“") || line.startsWith("«")) {
    return { type: "dialogue", text: line };
  }
  return { type: "paragraph", text: line };
}

function renderParagraph(p) {
  if (p.type === "break") {
    return `<p class="section-break">* * *</p>`;
  }
  const text = escHtml(p.text);
  if (p.type === "subheading") return `<p class="sub-heading"><strong>${text}</strong></p>`;
  if (p.type === "dialogue")   return `<p class="dialogue">${text}</p>`;
  return `<p>${text}</p>`;
}

function escHtml(t) {
  return t
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

// ═══════════════════════════════════════
// PAGINATION
// On utilise un .page-content hors-écran de mêmes dimensions que les vraies
// pages, on y ajoute paragraphe par paragraphe ; quand ça déborde, on coupe.
// ═══════════════════════════════════════
function paginateChapters(chapters) {
  const result = [];

  for (const chapter of chapters) {
    const titleHtml = `<h2 class="chapter-title">${escHtml(chapter.title)}</h2>`;

    // Démarrer la première page du chapitre avec son titre
    measureContent.innerHTML = `<div class="prose-wrap">${titleHtml}<div class="prose"></div></div>`;
    let proseEl = measureContent.querySelector(".prose");
    let isFirstOfChapter = true;
    let hasAnyContent = false;

    for (const rawLine of chapter.paragraphs) {
      const klass  = classifyParagraph(rawLine);
      const html   = renderParagraph(klass);

      proseEl.insertAdjacentHTML("beforeend", html);

      if (isOverflowing(measureContent)) {
        // Le dernier paragraphe a fait déborder : on le retire,
        // on enregistre la page courante, on en ouvre une nouvelle.
        const last = proseEl.lastElementChild;
        if (last) proseEl.removeChild(last);

        // Si on a au moins un paragraphe, sauver la page
        if (hasAnyContent || proseEl.children.length > 0) {
          result.push({
            chapterTitle: chapter.title,
            html: measureContent.innerHTML,
            isContinuation: !isFirstOfChapter,
          });
        }

        // Nouvelle page : pas de titre de chapitre (continuation)
        measureContent.innerHTML = `<div class="prose-wrap"><div class="prose"></div></div>`;
        proseEl = measureContent.querySelector(".prose");
        isFirstOfChapter = false;
        hasAnyContent = false;

        // Réinsérer le paragraphe qui n'avait pas tenu
        proseEl.insertAdjacentHTML("beforeend", html);

        // Cas extrême : le paragraphe seul déborde déjà → on l'accepte
        // (texte légèrement coupé visuellement, perte minimale).
        hasAnyContent = true;
      } else {
        hasAnyContent = true;
      }
    }

    // Sauver la dernière page du chapitre si non vide
    if (proseEl.children.length > 0 || isFirstOfChapter) {
      result.push({
        chapterTitle: chapter.title,
        html: measureContent.innerHTML,
        isContinuation: !isFirstOfChapter,
      });
    }
  }

  measureContent.innerHTML = "";
  return result;
}

function isOverflowing(el) {
  // Petit buffer (1px) pour les arrondis sub-pixel
  return el.scrollHeight > el.clientHeight + 1;
}

// ═══════════════════════════════════════
// CONSTRUCTION DES PAGES POUR STPAGEFLIP
// ═══════════════════════════════════════
function createPageEl({ header, contentHtml, pageNumber, extraClass }) {
  const el = document.createElement("div");
  el.className = "page" + (extraClass ? ` ${extraClass}` : "");
  el.style.width  = PAGE_W + "px";
  el.style.height = PAGE_H + "px";

  const headerHtml = header ? escHtml(header) : "";
  const numHtml    = pageNumber ? `— ${pageNumber} —` : "";

  el.innerHTML = `
    <div class="page-header">${headerHtml}</div>
    <div class="page-content">${contentHtml}</div>
    <div class="page-footer"><span class="page-number">${numHtml}</span></div>
  `;
  return el;
}

function buildBookPages() {
  bookFlip.innerHTML = "";

  // Page 1 : titre intérieur (pas de numéro)
  bookFlip.appendChild(createPageEl({
    header: "",
    contentHtml: `
      <div class="title-page">
        <div class="tp-rule"></div>
        <div class="tp-ornament">⚔</div>
        <h1 class="tp-title">${escHtml(bookTitle)}</h1>
        <p class="tp-subtitle">le Barbare</p>
        <div class="tp-rule"></div>
      </div>
    `,
    pageNumber: "",
    extraClass: "page-title",
  }));

  // Pages de contenu : numéros 2, 3, 4...
  pages.forEach((pg, idx) => {
    bookFlip.appendChild(createPageEl({
      header: bookTitle,
      contentHtml: pg.html,
      pageNumber: String(idx + 2),
    }));
  });

  // Page de fin
  bookFlip.appendChild(createPageEl({
    header: "",
    contentHtml: `
      <div class="title-page">
        <div class="tp-ornament">✦</div>
        <p class="tp-end">— Fin —</p>
        <div class="tp-rule"></div>
      </div>
    `,
    pageNumber: "",
    extraClass: "page-end",
  }));

  // S'assurer que le nombre de pages est pair (sinon StPageFlip ajoute un blanc)
  const total = bookFlip.children.length;
  if (total % 2 !== 0) {
    bookFlip.appendChild(createPageEl({
      header: "",
      contentHtml: "",
      pageNumber: "",
      extraClass: "page-blank",
    }));
  }
}

function initPageFlip() {
  if (pageFlip) return;

  pageFlip = new St.PageFlip(bookFlip, {
    width: PAGE_W,
    height: PAGE_H,
    size: "fixed",
    minWidth: 280,
    maxWidth: 600,
    minHeight: 400,
    maxHeight: 900,
    drawShadow: true,
    flippingTime: 700,
    showCover: false,
    usePortrait: true,
    startPage: 0,
    autoSize: true,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: false,
    swipeDistance: 30,
    showPageCorners: true,
    disableFlipByClick: false,
  });

  pageFlip.loadFromHTML(bookFlip.querySelectorAll(".page"));
  pageFlip.on("flip", updateNav);
  updateNav();
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════
function updateNav() {
  if (!pageFlip) {
    navInfo.textContent = "—";
    return;
  }
  const current = pageFlip.getCurrentPageIndex();   // 0-based
  const total   = pageFlip.getPageCount();

  prevBtn.disabled = current <= 0;
  nextBtn.disabled = current >= total - 1;

  // Afficher en numérotation "humaine" (1-based)
  navInfo.textContent = `${current + 1} / ${total}`;
}

// ═══════════════════════════════════════
// ÉVÉNEMENTS
// ═══════════════════════════════════════
openBtn.addEventListener("click", () => {
  viewCover.classList.add("hidden");
  viewBook.classList.remove("hidden");

  if (!pageFlip) {
    buildBookPages();
    // Laisser le DOM se layouter avant d'initialiser StPageFlip
    requestAnimationFrame(() => requestAnimationFrame(initPageFlip));
  }
});

closeBtn.addEventListener("click", () => {
  viewBook.classList.add("hidden");
  viewCover.classList.remove("hidden");
  if (pageFlip) {
    pageFlip.turnToPage(0);
    updateNav();
  }
});

prevBtn.addEventListener("click", () => {
  if (pageFlip) pageFlip.flipPrev();
});

nextBtn.addEventListener("click", () => {
  if (pageFlip) pageFlip.flipNext();
});

document.addEventListener("keydown", (e) => {
  if (viewBook.classList.contains("hidden")) return;
  if (e.key === "ArrowRight") { e.preventDefault(); pageFlip?.flipNext(); }
  if (e.key === "ArrowLeft")  { e.preventDefault(); pageFlip?.flipPrev(); }
  if (e.key === "Escape") closeBtn.click();
});

// ═══════════════════════════════════════
// GO
// ═══════════════════════════════════════
boot();
