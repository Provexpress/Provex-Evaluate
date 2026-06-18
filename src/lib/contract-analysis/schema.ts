export type Profitability = "alta" | "media" | "baja";
export type Risk = "alto" | "medio" | "bajo";
export type CashFlow = "fuerte" | "medio" | "debil";
export type RecommendationType = "firmar" | "firmar_con_condiciones" | "no_recomendado_sin_validacion";
export type Severity = "alta" | "media" | "baja";

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

export interface BillingConditions {
  payment_days: string;
  requirements: string;
  constraints: string;
  cash_flow_impact: string;
}

export interface ClauseImpact {
  clause_number: number;
  clause: string;
  detail: string;
  severity: Severity;
  financial_impact: string;
  operational_impact: string;
  risk_impact: string;
}

export interface PolicyDecision {
  name: string;
  applies: boolean;
  is_explicitly_required_by_contract: boolean;
  are_values_specified: boolean;
  value_details: string;
  applies_when: string;
  does_not_apply_when: string;
  estimated_cost: string;
  why_applies: string;
}

export interface PoliciesAnalysis {
  does_apply: boolean;
  required_status: string;
  are_policies_required_by_contract: boolean;
  is_policy_type_defined: boolean;
  is_policy_amount_defined: boolean;
  required_policies_text: string;
  policies_list: PolicyDecision[];
  business_impact: {
    cost_impact: string;
    profitability_impact: string;
    management_effort: string;
  };
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
  billing_conditions: BillingConditions;
  clause_impacts: ClauseImpact[];
  decision: {
    recommendation: string;
    type: RecommendationType;
    conditions: string[];
    minimum_value_required: string;
  };
  policies_analysis: PoliciesAnalysis;
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
  billing_conditions: {
    payment_days: "no encontrado",
    requirements: "no encontrado",
    constraints: "no encontrado",
    cash_flow_impact: "no encontrado"
  },
  clause_impacts: [],
  decision: {
    recommendation: "El contrato requiere revisión manual antes de proceder.",
    type: "firmar_con_condiciones",
    conditions: ["Revisar detalladamente las cláusulas de pago y multas."],
    minimum_value_required: "no especificado"
  },
  policies_analysis: {
    does_apply: false,
    required_status: "no definidas pero requeridas",
    are_policies_required_by_contract: false,
    is_policy_type_defined: false,
    is_policy_amount_defined: false,
    required_policies_text: "No se identificaron pólizas exigidas de forma explícita en el acuerdo.",
    policies_list: [
      {
        name: "Póliza de Cumplimiento",
        applies: true,
        is_explicitly_required_by_contract: false,
        are_values_specified: false,
        value_details: "Montos no especificados en el contrato",
        applies_when: "Se aplica si existen obligaciones contractuales y ejecución de servicios.",
        does_not_apply_when: "No requerido en contratos de suministro de bajo riesgo o única entrega.",
        estimated_cost: "No calculable",
        why_applies: "Requerido por defecto en servicios contratados."
      },
      {
        name: "Póliza de Responsabilidad Civil Extracontractual",
        applies: true,
        is_explicitly_required_by_contract: false,
        are_values_specified: false,
        value_details: "Montos no especificados en el contrato",
        applies_when: "Se aplica ante riesgos de daños a terceros o propiedad ajena durante la ejecución.",
        does_not_apply_when: "No requerido en servicios intelectuales puros o consultorías de bajo riesgo físico.",
        estimated_cost: "No calculable",
        why_applies: "Requerido por el riesgo de daños durante la ejecución."
      },
      {
        name: "Garantía de Calidad y Servicio (Performance)",
        applies: true,
        is_explicitly_required_by_contract: false,
        are_values_specified: false,
        value_details: "Montos no especificados en el contrato",
        applies_when: "Se aplica cuando existen obligaciones de desempeño a largo plazo y entregables técnicos.",
        does_not_apply_when: "No aplica si el pago se realiza posterior a la entrega y aceptación final a satisfacción.",
        estimated_cost: "No calculable",
        why_applies: "Requerido por las obligaciones de desempeño y entregables."
      },
      {
        name: "Garantía de Buen Manejo de Anticipo",
        applies: false,
        is_explicitly_required_by_contract: false,
        are_values_specified: false,
        value_details: "Montos no especificados en el contrato",
        applies_when: "Se aplica cuando el cliente realiza desembolsos de dinero por adelantado (anticipo) antes de ejecutar el servicio.",
        does_not_apply_when: "No aplica si no hay pagos anticipados o si todo el pago es contra entrega.",
        estimated_cost: "No aplica",
        why_applies: "No se identificó entrega de anticipos."
      }
    ],
    business_impact: {
      cost_impact: "Las pólizas representan un costo adicional que debe incluirse en el presupuesto general.",
      profitability_impact: "Reduce directamente el margen de ganancia neta del proyecto.",
      management_effort: "Requiere gestiones de cotización, expedición y seguimiento administrativo de renovación."
    }
  }
};

export function normalizeContractAnalysis(input: unknown): ContractAnalysis {
  const root = asRecord(input);
  
  // Extraer datos defensivamente
  const dataObj = asRecord(root.data || root.datos);
  const analysisObj = asRecord(root.analysis || root.analisis);
  const decisionObj = asRecord(root.decision);
  const rawFactorsObj = asRecord(root.factors_to_sign || root.factores_para_firmar || root.factores_clave);
  const rawBillingObj = asRecord(root.billing_conditions || root.condiciones_facturacion || root.facturacion);
  const rawClauseImpacts = root.clause_impacts || root.impactos_clausulas || root.impacto_clausulas || [];
  const issuesArray = root.issues || root.problemas_clave || root.problemas;
  const rawPoliciesObj = asRecord(root.policies_analysis || root.analisis_polizas || root.polizas_analisis);

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

  // Normalizar Condiciones de Facturación
  const billing_conditions: BillingConditions = {
    payment_days: stringField(rawBillingObj.payment_days || rawBillingObj.dias_pago || rawBillingObj.plazo, 200) || "no encontrado",
    requirements: stringField(rawBillingObj.requirements || rawBillingObj.requisitos || rawBillingObj.aprobacion, 400) || "no encontrado",
    constraints: stringField(rawBillingObj.constraints || rawBillingObj.restricciones || rawBillingObj.trabas, 400) || "no encontrado",
    cash_flow_impact: stringField(rawBillingObj.cash_flow_impact || rawBillingObj.impacto_flujo_caja || rawBillingObj.impacto, 400) || "no encontrado"
  };

  // Normalizar Impacto de Cláusulas (nuevo formato extendido)
  let clause_impacts: ClauseImpact[] = [];
  if (Array.isArray(rawClauseImpacts)) {
    clause_impacts = rawClauseImpacts.map((item, idx) => {
      const rec = asRecord(item);
      // Soportar formato nuevo (impactos separados) y formato legado (business_impact unificado)
      const legacyImpact = stringField(rec.business_impact || rec.impacto_negocio || rec.impacto, 600);
      return {
        clause_number: typeof rec.clause_number === "number" ? rec.clause_number : idx + 1,
        clause: stringField(rec.clause || rec.clausula || rec.nombre, 120) || "Cláusula no identificada",
        detail: stringField(rec.detail || rec.detalle || rec.texto, 500) || "no encontrado",
        severity: normalizeSeverity(rec.severity || rec.gravedad || rec.severidad),
        financial_impact: stringField(rec.financial_impact || rec.impacto_financiero, 400) || legacyImpact || "no especificado",
        operational_impact: stringField(rec.operational_impact || rec.impacto_operacional, 400) || "no especificado",
        risk_impact: stringField(rec.risk_impact || rec.impacto_riesgo, 400) || "no especificado"
      };
    });
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
    billing_conditions,
    clause_impacts,
    decision: {
      recommendation: stringField(decisionObj.recommendation || decisionObj.explicacion || decisionObj.reason, 500) || DEFAULT_ANALYSIS.decision.recommendation,
      type: normalizeRecommendationType(decisionObj.type || decisionObj.recomendacion || decisionObj.tipo),
      conditions,
      minimum_value_required: stringField(decisionObj.minimum_value_required || decisionObj.valor_minimo_requerido || decisionObj.valor_minimo, 200) || "no especificado"
    },
    policies_analysis: (() => {
      const are_policies_required_by_contract = rawPoliciesObj.are_policies_required_by_contract !== undefined
        ? Boolean(rawPoliciesObj.are_policies_required_by_contract)
        : (String(rawPoliciesObj.required_status || rawPoliciesObj.required_policies || "").toLowerCase().includes("requerid") || 
           String(rawPoliciesObj.required_status || rawPoliciesObj.required_policies || "").toLowerCase().includes("sí") || 
           String(rawPoliciesObj.required_status || rawPoliciesObj.required_policies || "").toLowerCase().includes("si") || 
           String(root.policies || "").toLowerCase() !== "no encontrado");

      const is_policy_type_defined = rawPoliciesObj.is_policy_type_defined !== undefined
        ? Boolean(rawPoliciesObj.is_policy_type_defined)
        : (are_policies_required_by_contract && 
           String(root.policies || "").toLowerCase() !== "no encontrado" && 
           !String(root.policies || "").toLowerCase().includes("no definido") && 
           !String(root.policies || "").toLowerCase().includes("no especificado"));

      const is_policy_amount_defined = rawPoliciesObj.is_policy_amount_defined !== undefined
        ? Boolean(rawPoliciesObj.is_policy_amount_defined)
        : (are_policies_required_by_contract && 
           String(root.policies || "").toLowerCase() !== "no encontrado" && 
           !String(root.policies || "").toLowerCase().includes("monto no especificado") && 
           !String(root.policies || "").toLowerCase().includes("no define"));

      const does_apply = are_policies_required_by_contract || rawPoliciesObj.does_apply === true;

      const required_status = stringField(
        rawPoliciesObj.required_status || 
        rawPoliciesObj.estado_requerido || 
        (are_policies_required_by_contract ? "Pólizas requeridas" : "Pólizas no requeridas"),
        100
      );

      const required_policies_text = stringField(
        rawPoliciesObj.required_policies_text || rawPoliciesObj.texto_polizas_requeridas,
        800
      ) || (are_policies_required_by_contract 
             ? (is_policy_type_defined && is_policy_amount_defined 
                ? (String(root.policies || "") !== "no encontrado" ? String(root.policies) : "Se identificaron pólizas exigidas con tipo y monto.")
                : "El contrato exige pólizas, pero no define el tipo ni el monto. Debe validarse con la orden de compra o el cliente.")
             : "El contrato no exige de forma explícita la constitución de pólizas de seguros.");

      const rawPoliciesList = Array.isArray(rawPoliciesObj.policies_list || rawPoliciesObj.lista_polizas || rawPoliciesObj.policies)
        ? (rawPoliciesObj.policies_list || rawPoliciesObj.lista_polizas || rawPoliciesObj.policies)
        : [];

      let policies_list: PolicyDecision[] = [];
      if (Array.isArray(rawPoliciesList) && rawPoliciesList.length > 0) {
        policies_list = rawPoliciesList.map((item, idx) => {
          const rec = asRecord(item);
          return {
            name: stringField(rec.name || rec.nombre || rec.policy_type || rec.tipo, 150) || `Póliza ${idx + 1}`,
            applies: rec.applies !== undefined ? Boolean(rec.applies) : Boolean(rec.aplica || false),
            is_explicitly_required_by_contract: rec.is_explicitly_required_by_contract !== undefined
              ? Boolean(rec.is_explicitly_required_by_contract)
              : Boolean(rec.requerida_por_contrato || false),
            are_values_specified: rec.are_values_specified !== undefined ? Boolean(rec.are_values_specified) : Boolean(rec.montos_especificados || false),
            value_details: stringField(rec.value_details || rec.detalle_montos || rec.detalles_valor || rec.valor, 500) || "No especificado en el contrato",
            applies_when: stringField(rec.applies_when || rec.cuando_aplica || rec.condiciones_si, 500) || "",
            does_not_apply_when: stringField(rec.does_not_apply_when || rec.cuando_no_aplica || rec.condiciones_no, 500) || "",
            estimated_cost: stringField(rec.estimated_cost || rec.costo_estimado, 200) || "No calculable",
            why_applies: stringField(rec.why_applies || rec.porque_aplica || rec.explicacion, 400) || ""
          };
        });
      } else {
        policies_list = DEFAULT_ANALYSIS.policies_analysis.policies_list.map(p => ({ ...p }));
      }

      // Rellenar las reglas por defecto para la aplicabilidad si vienen vacías
      policies_list = policies_list.map(p => {
        const nameLower = p.name.toLowerCase();
        const defPolicy = DEFAULT_ANALYSIS.policies_analysis.policies_list.find(dp => dp.name.toLowerCase().includes(nameLower) || nameLower.includes(dp.name.toLowerCase()));
        
        const isRequired = p.is_explicitly_required_by_contract;
        
        return {
          ...p,
          is_explicitly_required_by_contract: isRequired,
          applies_when: p.applies_when || defPolicy?.applies_when || "Se aplica bajo requerimiento del cliente o ejecución de hitos.",
          does_not_apply_when: p.does_not_apply_when || defPolicy?.does_not_apply_when || "No aplica si es exceptuado formalmente por mutuo acuerdo."
        };
      });

      const rawImpact = asRecord(rawPoliciesObj.business_impact || rawPoliciesObj.impacto_negocio || rawPoliciesObj.impacto);
      const business_impact = {
        cost_impact: stringField(rawImpact.cost_impact || rawImpact.impacto_costos || rawPoliciesObj.business_impact || rawPoliciesObj.impacto || "", 500) || DEFAULT_ANALYSIS.policies_analysis.business_impact.cost_impact,
        profitability_impact: stringField(rawImpact.profitability_impact || rawImpact.impacto_rentabilidad || "", 500) || DEFAULT_ANALYSIS.policies_analysis.business_impact.profitability_impact,
        management_effort: stringField(rawImpact.management_effort || rawImpact.esfuerzo_gestion || rawImpact.gestion || "", 500) || DEFAULT_ANALYSIS.policies_analysis.business_impact.management_effort
      };

      return {
        does_apply,
        required_status,
        are_policies_required_by_contract,
        is_policy_type_defined,
        is_policy_amount_defined,
        required_policies_text,
        policies_list,
        business_impact
      };
    })()
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

function normalizeSeverity(value: unknown): Severity {
  const val = String(value).trim().toLowerCase();
  if (val === "high" || val === "alto" || val === "alta") return "alta";
  if (val === "medium" || val === "medio" || val === "media") return "media";
  if (val === "low" || val === "bajo" || val === "baja") return "baja";
  return "media";
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
