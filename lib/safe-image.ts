import { AccessError } from "@/lib/tenant";

const allowed = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
export function safeImageType(type: string) {
  return allowed.has(type);
}

// Reject active formats (SVG/HTML) and spoofed MIME types before storing them.
export async function validateImage(file: File, maxBytes: number) {
  if (!safeImageType(file.type) || !file.size || file.size > maxBytes)
    throw new AccessError(400, "Bruk PNG, JPEG, GIF eller WebP innenfor størrelsesgrensen.");
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = (start: number, end: number) => String.fromCharCode(...b.slice(start, end));
  const valid = file.type === "image/png" ? [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)
    : file.type === "image/jpeg" ? b[0]===255 && b[1]===216 && b[2]===255
    : file.type === "image/gif" ? ["GIF87a", "GIF89a"].includes(text(0,6))
    : text(0,4)==="RIFF" && text(8,12)==="WEBP";
  if (!valid) throw new AccessError(400, "Filen samsvarer ikke med den oppgitte bildetypen.");
}
