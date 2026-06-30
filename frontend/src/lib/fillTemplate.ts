// Remplace les placeholders {{KEY}} dans un template HTML Claude Design.
// Les templates contiennent un bloc <script id="preview-data"> (données de démo)
// et un objet D dont les valeurs sont '{{KEY}}'. Ce helper :
//   1. supprime le bloc preview-data
//   2. retire le fallback window.__PREVIEW
//   3. substitue chaque '{{KEY}}' par la valeur réelle (échappée JS)

export function fillTemplate(
  html: string,
  data: Record<string, string>,
): string {
  let result = html
    .replace(/<script id="preview-data">[\s\S]*?<\/script>\s*/g, "")
    .replace(/,\s*window\.__PREVIEW\s*\|\|\s*\{\}/g, "");

  for (const [key, value] of Object.entries(data)) {
    const escaped = (value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r\n/g, "\\n")
      .replace(/\n/g, "\\n");
    result = result.split(`'{{${key}}}'`).join(`'${escaped}'`);
  }
  return result;
}
