import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "./errors";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage/uploads");

/** Tipo detectado pelos primeiros bytes do arquivo (não confia no tipo informado pelo navegador). */
function detectType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG") return { mime: "image/png", ext: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

function resolveKey(key: string): string {
  if (!/^[0-9]{4}\/[0-9]{2}\/[a-f0-9]{32}\.(pdf|png|jpg|webp)$/.test(key)) throw new Error("Chave de arquivo inválida");
  return path.join(ROOT, key);
}

export interface StoredFile {
  storageKey: string;
  mimeType: string;
  size: number;
  sha256: string;
  fileName: string;
}

export async function storeUpload(file: File): Promise<StoredFile> {
  if (file.size === 0) throw new DomainError("O arquivo está vazio.");
  if (file.size > MAX_UPLOAD_BYTES) throw new DomainError("O arquivo excede 10 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectType(buf);
  if (!type) throw new DomainError("Formato não aceito. Envie PDF, JPG, PNG ou WEBP.");
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(16).toString("hex")}.${type.ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { flag: "wx", mode: 0o600 });
  const safeName = (file.name || `documento.${type.ext}`).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
  return { storageKey: key, mimeType: type.mime, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), fileName: safeName };
}

export async function readStored(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function removeStored(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => rm(resolveKey(k), { force: true }).catch(() => undefined)));
}
