export type Profitability = "alta" | "media" | "baja";
export type Risk = "alto" | "medio" | "bajo";
export type CashFlow = "fuerte" | "medio" | "debil";
export type RecommendationType = "firmar" | "firmar_con_condiciones" | "no_recomendado_sin_validacion";

export interface Metric<T> {
  val: T;
  reason: string;
}

export interface FactorsToSign {
  minimum_value_required: string;
  payment_conditions: string;
  risk_tolerance: string;
  cost_coverage: string;
  operational_requirements: string;
}

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
    financials_from_po: boolean;
  };
  analysis: {
    profitability: Metric<Profitability>;
    risk: Metric<Risk>;
    cash_flow: Metric<CashFlow>;
  };
  issues: string[];
  factors_to_sign: FactorsToSign;
  decision: {
    recommendation: string;
    type: RecommendationType;
    conditions: string[];
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
    termination: "no encontrado",
    financials_from_po: false
  },
  analysis: {
    profitability: { val: "baja", reason: "Análisis financiero predeterminado por falta de datos." },
    risk: { val: "alto", reason: "Riesgo predeterminado por falta de cláusulas explícitas." },
    cash_flow: { val: "debil", reason: "Flujo de caja debilitado debido a ausencia de plazos estructurados." }
  },
  issues: ["La respuesta del análisis no incluyó suficientes datos del contrato."],
  factors_to_sign: {
    minimum_value_required: "No determinado",
    payment_conditions: "No determinadas",
    risk_tolerance: "No determinada",
    cost_coverage: "No determinado",
    operational_requirements: "No determinados"
  },
  decision: {
    recommendation: "El contrato requiere revisión manual antes de proceder.",
    type: "firmar_con_condiciones",
    conditions: ["Revisar detalladamente las cláusulas de pago y multas."],
    minimum_value_required: "no especificado"
  }
};

export function normalizeContractAnalysis(input: unknown): ContractAnalysis {
  const root = asRecord(input);
  
  // Extraer datos defensivamente
  const dataObj = asRecord(root.data || root.datos);
  const analysisObj = asRecord(root.analysis || root.analisis);
  const decisionObj = asRecord(root.decision);
  const rawFactorsObj = asRecord(root.factors_to_sign || root.factores_para_firmar || root.factores_clave);
  const issuesArray = root.issues || root.problemas_clave || root.problemas;

  // Normalizar partes
  let normalizedParties: Record<string, string> | string = {};
  const rawParties = dataObj.parties || dataObj.partes;
  if (typeof rawParties === "string") {
    normalizedParties = stringField(rawParties, 500);
  } else if (rawParties && typeof rawParties === "object") {
    normalizedParties = normalizeParties(rawParties);
  }

  // Normalizar métricas con justificaciones
  const rawProfit = analysisObj.profitability || analysisObj.rentabilidad;
  const rawRisk = analysisObj.risk || analysisObj.riesgo;
  const rawCash = analysisObj.cash_flow || analysisObj.flujo_caja;

  const profitability: Metric<Profitability> = {
    val: normalizeProfitability(isRecord(rawProfit) ? rawProfit.val || rawProfit.valor : rawProfit),
    reason: stringField(isRecord(rawProfit) ? rawProfit.reason || rawProfit.explicacion || rawProfit.porque : "", 350) || "Basado en el análisis de márgenes y costos del proyecto."
  };

  const risk: Metric<Risk> = {
    val: normalizeRisk(isRecord(rawRisk) ? rawRisk.val || rawRisk.valor : rawRisk),
    reason: stringField(isRecord(rawRisk) ? rawRisk.reason || rawRisk.explicacion || rawRisk.porque : "", 350) || "Basado en la evaluación de multas, pólizas y cláusulas unilaterales."
  };

  const cash_flow: Metric<CashFlow> = {
    val: normalizeCashFlow(isRecord(rawCash) ? rawCash.val || rawCash.valor : rawCash),
    reason: stringField(isRecord(rawCash) ? rawCash.reason || rawCash.explicacion || rawCash.porque : "", 350) || "Basado en los plazos de facturación y dependencias de aprobación."
  };

  // Normalizar condiciones de decisión
  let conditions: string[] = [];
  const rawConditions = decisionObj.conditions || decisionObj.condiciones;
  if (Array.isArray(rawConditions)) {
    conditions = rawConditions.map((c) => stringField(c, 250)).filter(Boolean);
  } else if (typeof rawConditions === "string" && rawConditions.trim()) {
    conditions = [stringField(rawConditions, 250)];
  }
  if (conditions.length === 0) {
    conditions = [...DEFAULT_ANALYSIS.decision.conditions];
  }

  // Normalizar bandera de Orden de Compra
  const financials_from_po = Boolean(dataObj.financials_from_po || dataObj.datos_de_po || root.financials_from_po || false);

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
      termination: stringField(dataObj.termination || dataObj.terminacion, 700) || "no encontrado",
      financials_from_po
    },
    analysis: {
      profitability,
      risk,
      cash_flow
    },
    issues: stringArrayField(issuesArray, DEFAULT_ANALYSIS.issues),
    factors_to_sign: {
      minimum_value_required: stringField(rawFactorsObj.minimum_value_required || rawFactorsObj.valor_minimo, 300) || "No especificado",
      payment_conditions: stringField(rawFactorsObj.payment_conditions || rawFactorsObj.condiciones_pago, 300) || "No especificado",
      risk_tolerance: stringField(rawFactorsObj.risk_tolerance || rawFactorsObj.tolerancia_riesgo, 300) || "No especificado",
      cost_coverage: stringField(rawFactorsObj.cost_coverage || rawFactorsObj.cobertura_costos, 300) || "No especificado",
      operational_requirements: stringField(rawFactorsObj.operational_requirements || rawFactorsObj.requisitos_operativos, 300) || "No especificado"
    },
    decision: {
      recommendation: stringField(decisionObj.recommendation || decisionObj.explicacion || decisionObj.reason, 500) || DEFAULT_ANALYSIS.decision.recommendation,
      type: normalizeRecommendationType(decisionObj.type || decisionObj.recomendacion || decisionObj.tipo),
      conditions,
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
  if (val === "no_recomendado_sin_validacion" || val === "no_firmar" || val === "do_not_sign" || val === "do-not-sign") return "no_recomendado_sin_validacion";
  return "firmar_con_condiciones";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
