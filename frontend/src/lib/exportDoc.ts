// Export de documents (livrables) — PDF (impression navigateur) et Word (.doc).
//
// Le même HTML complet sert aux deux sorties :
//   - printHtml()   → ouvre l'onglet et lance l'impression (Enregistrer en PDF)
//   - downloadWord() → télécharge un .doc qui s'ouvre dans Word (astuce HTML→Word,
//     type application/msword + BOM UTF-8 pour préserver les accents).
//
// Chaque page construit son HTML via un buildDocHtml() local (mise en page propre
// au livrable) puis appelle ces helpers — zéro duplication de la logique d'export.

// Échappement HTML (anti-injection dans le document généré).
export function escapeHtml(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Nom de fichier sûr (sans accents ni caractères spéciaux).
export function slugify(s: unknown, fallback = "nova"): string {
  const base = String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || fallback;
}

// Ouvre le HTML dans un onglet et déclenche l'impression (→ PDF).
export function printHtml(fullHtml: string, delay = 350): void {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Le navigateur a bloqué la fenêtre d'impression. Autorisez les pop-ups pour ce site, puis réessayez.");
    return;
  }
  w.document.write(fullHtml);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), delay);
}

// Télécharge le HTML complet en .doc (s'ouvre dans Word / LibreOffice).
export function downloadWord(baseName: string, fullHtml: string): void {
  try {
    const blob = new Blob(["﻿" + fullHtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(baseName)}.doc`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 150);
  } catch {
    alert("Export Word impossible — le navigateur a bloqué le téléchargement.");
  }
}
