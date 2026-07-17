import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const PDF_PARSE_SHIM = path.resolve(process.cwd(), "pdf-parse-shim.cjs");

// pdf-parse (via son bundle pdf.js interne, très ancien) échoue silencieusement
// ("bad XRef entry" sur des PDF pourtant valides) dès que la chaîne d'appel qui y mène
// remonte à un fichier chargé comme module ESM — y compris via createRequire() depuis
// un vrai fichier .cjs. Seule l'exécution "inline" d'un script Node (node -e) s'est
// montrée fiable dans tous les cas testés. On isole donc l'extraction dans un
// sous-processus Node minimal plutôt que de l'appeler en process, pour un coût
// négligeable sur une action admin ponctuelle (upload de PDF).
const CHILD_SCRIPT = `
const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", async () => {
  try {
    const pdfParse = require(${JSON.stringify(PDF_PARSE_SHIM)});
    const parsed = await pdfParse(Buffer.concat(chunks));
    process.stdout.write(JSON.stringify({ text: parsed.text }));
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
});
`;

async function extractPdfTextViaChildProcess(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", CHILD_SCRIPT]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `pdf-parse subprocess exited with code ${code}`));
        return;
      }
      try {
        const result = JSON.parse(stdout) as { text?: string; error?: string };
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.text ?? "");
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    child.stdin.write(buffer);
    child.stdin.end();
  });
}

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function savePdfFile(filename: string, buffer: Buffer) {
  await ensureUploadDir();
  const storedFilename = `${randomUUID()}-${sanitizeFilename(filename)}`;
  await writeFile(path.join(UPLOAD_DIR, storedFilename), buffer);

  let contenuExtrait: string | null = null;
  let statutExtraction: "DONE" | "ERROR" = "DONE";
  try {
    contenuExtrait = (await extractPdfTextViaChildProcess(buffer)).trim();
  } catch {
    statutExtraction = "ERROR";
  }

  return { storedFilename, contenuExtrait, statutExtraction };
}

/** Extraction de texte seule, sans persister le fichier — pour un contenu (énoncé,
 * corrigé) dont seul le texte importe, contrairement à Cours/Chapitre/Evaluation qui
 * re-servent le PDF original via un endpoint dédié. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  return (await extractPdfTextViaChildProcess(buffer)).trim();
}

export function getPdfFilePath(storedFilename: string) {
  return path.join(UPLOAD_DIR, storedFilename);
}

export function pdfFileExists(storedFilename: string) {
  return existsSync(getPdfFilePath(storedFilename));
}

export async function deletePdfFile(storedFilename: string) {
  const filePath = getPdfFilePath(storedFilename);
  if (existsSync(filePath)) await unlink(filePath);
}
