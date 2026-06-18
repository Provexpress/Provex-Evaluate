export interface PreparedContractText {
  text: string;
  originalLength: number;
  preparedLength: number;
  truncated: boolean;
  chunksUsed: number;
}

const DEFAULT_MAX_AI_CHARS = 65000;
const CHUNK_SIZE = 4500;
const RESERVED_EDGE_CHARS = 9000;

const BUSINESS_KEYWORDS = [
  "valor",
  "precio",
  "monto",
  "presupuesto",
  "pago",
  "pagos",
  "factura",
  "facturacion",
  "anticipo",
  "retencion",
  "garantia",
  "poliza",
  "penalidad",
  "multa",
  "sancion",
  "incumplimiento",
  "terminacion",
  "unilateral",
  "plazo",
  "duracion",
  "trm",
  "moneda",
  "costos",
  "gastos",
  "contratista",
  "aprobacion",
  "aceptacion",
  "interventoria",
  "liquidacion",
  "value",
  "price",
  "amount",
  "payment",
  "invoice",
  "penalty",
  "termination",
  "unilateral",
  "duration",
  "costs",
  "expenses",
  "approval",
  "acceptance"
];

export function cleanContractText(rawText: string): string {
  return rawText
    .replace(/\u0000/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/-\s*\n\s*/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function prepareContractTextForAi(
  cleanText: string,
  maxChars = DEFAULT_MAX_AI_CHARS
): PreparedContractText {
  const safeMaxChars = Math.max(12000, maxChars);

  if (cleanText.length <= safeMaxChars) {
    return {
      text: cleanText,
      originalLength: cleanText.length,
      preparedLength: cleanText.length,
      truncated: false,
      chunksUsed: 1
    };
  }

  const intro = cleanText.slice(0, RESERVED_EDGE_CHARS);
  const outro = cleanText.slice(-RESERVED_EDGE_CHARS);
  const middle = cleanText.slice(RESERVED_EDGE_CHARS, -RESERVED_EDGE_CHARS);
  const chunks = chunkText(middle, CHUNK_SIZE)
    .map((chunk, index) => ({
      chunk,
      index,
      score: scoreBusinessChunk(chunk)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: string[] = [];
  let usedChars = intro.length + outro.length + 700;
  const chunkBudget = safeMaxChars - usedChars;

  for (const item of chunks) {
    if (item.score <= 0) {
      continue;
    }

    if (selected.join("\n\n").length + item.chunk.length > chunkBudget) {
      continue;
    }

    selected.push(`[Ranked chunk ${item.index + 1}]\n${item.chunk}`);
  }

  if (selected.length === 0 && chunks.length > 0) {
    selected.push(`[Ranked chunk ${chunks[0].index + 1}]\n${chunks[0].chunk}`);
  }

  const prepared = [
    "[Contract opening clauses]",
    intro,
    "[High-priority financial and risk clauses]",
    selected.join("\n\n"),
    "[Contract closing clauses]",
    outro
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, safeMaxChars);

  return {
    text: prepared,
    originalLength: cleanText.length,
    preparedLength: prepared.length,
    truncated: true,
    chunksUsed: selected.length + 2
  };
}

function chunkText(text: string, maxChunkChars: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim();

    if (!normalized) {
      continue;
    }

    if ((current + "\n\n" + normalized).length > maxChunkChars && current) {
      chunks.push(current);
      current = normalized;
    } else {
      current = current ? `${current}\n\n${normalized}` : normalized;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function scoreBusinessChunk(chunk: string): number {
  const lower = chunk.toLowerCase();
  let score = 0;

  for (const keyword of BUSINESS_KEYWORDS) {
    if (lower.includes(keyword)) {
      score += 4;
    }
  }

  score += (chunk.match(/[$%]|\b(cop|usd|eur)\b/gi) ?? []).length * 3;
  score += (chunk.match(/\b\d{1,3}([.,]\d{3})+([.,]\d{1,2})?\b/g) ?? []).length * 2;
  score += (chunk.match(/\b\d{1,3}\s*(dias|meses|anos|days|months|years)\b/gi) ?? [])
    .length;

  return score;
}
