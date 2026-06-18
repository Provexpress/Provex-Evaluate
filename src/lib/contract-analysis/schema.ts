export type Profitability = "alta" | "media" | "baja";
export type Risk = "alto" | "medio" | "bajo";
export type CashFlow = "fuerte" | "medio" | "debil";
export type RecommendationType = "firmar" | "firmar_con_condiciones" | "no_firmar";

export interface ContractAnalysis {
  data: {
    parties: Record<string, string> | string;
    value: string;
    currency: string;
    trm: string;
    duration: string;
    payment_terms: string;
    policies: string;
    penalties: string;
    termination: string;
  };
  analysis: {
    profitability: Profitability;
    risk: Risk;
    cash_flow: CashFlow;
  };
  issues: string[];
  decision: {
    recommendation: string;
    type: RecommendationType;
    conditions: string;
    minimum_value_required: string;
  };
}

const DEFAULT_ANALYSIS: ContractAnalysis = {
  data: {
    parties: {},
    value: "no encontrado",
    currency: "no encontrado",
    trm: "no encontrado",
    duration: "no encontrado",
    payment_terms: "no encontrado",
    policies: "no encontrado",
    penalties: "no encontrado",
    termination: "no encontrado"
  },
  analysis: {
    profitability: "baja",
    risk: "alto",
    cash_flow: "debil"
  },
  issues: ["La respuesta de la IA no incluyó suficientes datos estructurados del contrato."],
  decision: {
    recommendation: "El contrato requiere revisión manual antes de firmar.",
    type: "firmar_con_condiciones",
    conditions: "Revisar los términos financieros y las penalidades del contrato.",
    minimum_value_required: "no especificado"
  }
};

export function normalizeContractAnalysis(input: unknown): ContractAnalysis {
  const root = asRecord(input);
  
  // Defensive extraction for data/datos
  const dataObj = asRecord(root.data || root.datos);
  // Defensive extraction for analysis/analisis
  const analysisObj = asRecord(root.analysis || root.analisis);
  // Defensive extraction for decision
  const decisionObj = asRecord(root.decision);
  // Defensive extraction for issues/problemas_clave/problemas
  const issuesArray = root.issues || root.problemas_clave || root.problemas;

  // Handle parties mapping (could be object or string)
  let normalizedParties: Record<string, string> | string = {};
  const rawParties = dataObj.parties || dataObj.partes;
  if (typeof rawParties === "string") {
    normalizedParties = stringField(rawParties, 500);
  } else if (rawParties && typeof rawParties === "object") {
    normalizedParties = normalizeParties(rawParties);
  }

  return {
    data: {
      parties: normalizedParties,
      value: stringField(dataObj.value || dataObj.valor, 240) || "no encontrado",
      currency: stringField(dataObj.currency || dataObj.moneda, 80) || "no encontrado",
      trm: stringField(dataObj.trm || dataObj.TRM, 160) || "no encontrado",
      duration: stringField(dataObj.duration || dataObj.duracion, 240) || "no encontrado",
      payment_terms: stringField(dataObj.payment_terms || dataObj.forma_pago, 700) || "no encontrado",
      policies: stringField(dataObj.policies || dataObj.polizas, 700) || "no encontrado",
      penalties: stringField(dataObj.penalties || dataObj.penalidades, 700) || "no encontrado",
      termination: stringField(dataObj.termination || dataObj.terminacion, 700) || "no encontrado"
    },
    analysis: {
      profitability: normalizeProfitability(analysisObj.profitability || analysisObj.rentabilidad),
      risk: normalizeRisk(analysisObj.risk || analysisObj.riesgo),
      cash_flow: normalizeCashFlow(analysisObj.cash_flow || analysisObj.flujo_caja)
    },
    issues: stringArrayField(issuesArray, DEFAULT_ANALYSIS.issues),
    decision: {
      recommendation: stringField(decisionObj.recommendation || decisionObj.explicacion || decisionObj.reason, 500) || DEFAULT_ANALYSIS.decision.recommendation,
      type: normalizeRecommendationType(decisionObj.type || decisionObj.recomendacion || decisionObj.tipo),
      conditions: stringField(decisionObj.conditions || decisionObj.condiciones, 500) || "no encontrado",
      minimum_value_required: stringField(decisionObj.minimum_value_required || decisionObj.valor_minimo_requerido || decisionObj.valor_minimo, 200) || "no especificado"
    }
  };
}

export function safeJsonParseObject(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error("La respuesta de la IA no contenía un objeto JSON válido.");
    }

    return JSON.parse(content.slice(jsonStart, jsonEnd + 1));
  }
}

function normalizeParties(value: unknown): Record<string, string> {
  const record = asRecord(value);
  const partes: Record<string, string> = {};

  for (const [key, item] of Object.entries(record)) {
    const safeKey = stringField(key, 80);
    const safeValue = stringField(item, 220);

    if (safeKey && safeValue) {
      partes[safeKey] = safeValue;
    }
  }

  return partes;
}

function stringArrayField(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .map((item) => stringField(item, 180))
    .filter(Boolean)
    .slice(0, 10);

  return items.length > 0 ? items : fallback;
}

function stringField(value: unknown, maxLength: number): string {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeProfitability(value: unknown): Profitability {
  const val = String(value).trim().toLowerCase();
  if (val === "high" || val === "alta") return "alta";
  if (val === "medium" || val === "media") return "media";
  if (val === "low" || val === "baja") return "baja";
  return "baja";
}

function normalizeRisk(value: unknown): Risk {
  const val = String(value).trim().toLowerCase();
  if (val === "high" || val === "alto" || val === "alta") return "alto";
  if (val === "medium" || val === "medio" || val === "media") return "medio";
  if (val === "low" || val === "bajo" || val === "baja") return "bajo";
  return "alto";
}

function normalizeCashFlow(value: unknown): CashFlow {
  const val = String(value).trim().toLowerCase();
  if (val === "strong" || val === "fuerte") return "fuerte";
  if (val === "medium" || val === "medio") return "medio";
  if (val === "weak" || val === "debil" || val === "débil") return "debil";
  return "debil";
}

function normalizeRecommendationType(value: unknown): RecommendationType {
  const val = String(value).trim().toLowerCase();
  if (val === "firmar" || val === "sign") return "firmar";
  if (val === "firmar_con_condiciones" || val === "conditional" || val === "condicional") return "firmar_con_condiciones";
  if (val === "no_firmar" || val === "do_not_sign") return "no_firmar";
  return "firmar_con_condiciones";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
