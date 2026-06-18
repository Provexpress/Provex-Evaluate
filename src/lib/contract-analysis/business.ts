import type {
  CashFlow,
  ContractAnalysis,
  Profitability,
  RecommendationType,
  Risk
} from "./schema";

export interface BusinessInputs {
  estimated_cost?: number;
  expected_margin?: number;
}

const RISK_SCORE: Record<Risk, number> = {
  bajo: 1,
  medio: 2,
  alto: 3
};

const CASH_FLOW_SCORE: Record<CashFlow, number> = {
  debil: 1,
  medio: 2,
  fuerte: 3
};

export function enforceBusinessRules(
  contract: ContractAnalysis,
  businessInputs?: BusinessInputs
): ContractAnalysis {
  const next = cloneContractAnalysis(contract);
  const issues = new Set(next.issues);
  const conditions = new Set(next.decision.conditions);

  // Check missing value
  const valMissing = isValueMissing(next.data.value);
  if (valMissing) {
    next.analysis.risk.val = higherRisk(next.analysis.risk.val, "alto");
    next.analysis.risk.reason = "Valor del contrato no especificado en el acuerdo principal o adjuntos; riesgo de ingresos inciertos.";
    next.analysis.cash_flow.val = weakerCashFlow(next.analysis.cash_flow.val, "debil");
    next.analysis.cash_flow.reason = "Imposible proyectar cobros al no existir un valor contractual pactado.";
    issues.add("El valor del contrato no está definido; no se pueden validar los ingresos ni el margen.");
    conditions.add("Establecer un valor comercial explícito para el contrato en una adenda.");
  }

  // Payment approval logic
  const approvalRequired = paymentDependsOnApproval(next.data.payment_terms);
  if (approvalRequired) {
    next.analysis.cash_flow.val = weakerCashFlow(next.analysis.cash_flow.val, "debil");
    next.analysis.cash_flow.reason = "Los plazos de facturación dependen de aprobaciones externas o hitos de interventoría.";
    
    next.billing_conditions.requirements = next.billing_conditions.requirements === "no encontrado"
      ? "Requiere aprobación del supervisor y radicación de factura antes del pago."
      : next.billing_conditions.requirements;
      
    next.billing_conditions.cash_flow_impact = "La ventana de aprobación del cliente puede retrasar la liquidez y debilitar el flujo de caja.";
    
    issues.add("El pago depende de aprobación o aceptación; el flujo de caja es más débil.");
    conditions.add("Negociar plazos de pago fijos y automáticos sin depender de la firma de un supervisor.");
  }

  // Costs on contractor logic
  const contractorCosts = costsFallOnContractor(next);
  if (contractorCosts) {
    next.analysis.profitability.val = downgradeProfitability(next.analysis.profitability.val);
    next.analysis.profitability.reason = "El proveedor debe asumir la totalidad de costos operativos y pólizas exigidas.";
    issues.add("El contrato traslada costos o gastos al contratista.");
    conditions.add("Distribuir o cofinanciar costos de pólizas y garantías exigidas en el acuerdo.");
  }

  // Unilateral termination logic
  const unilateralTerm = hasUnilateralTermination(next.data.termination);
  if (unilateralTerm) {
    next.analysis.risk.val = higherRisk(next.analysis.risk.val, "alto");
    next.analysis.risk.reason = "Cláusulas permiten la rescisión del acuerdo sin justa causa e indemnización a favor del cliente.";
    issues.add("La terminación parece unilateral; el riesgo de continuidad para el contratista es alto.");
    conditions.add("Incluir preaviso recíproco de mínimo 30 días y compensaciones por terminación anticipada.");
  }

  // Enrich clause impacts
  enrichClauseImpacts(next, approvalRequired, contractorCosts, unilateralTerm);

  // Financial calculations and viability parameters check
  if (businessInputs && businessInputs.estimated_cost !== undefined && businessInputs.expected_margin !== undefined) {
    const cost = businessInputs.estimated_cost;
    const margin = businessInputs.expected_margin;
    const minVal = cost * (1 + margin / 100);
    
    next.decision.minimum_value_required = `${minVal.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD`;
    
    if (valMissing) {
      next.decision.type = "firmar_con_condiciones";
      conditions.add(`Negociar un valor comercial de al menos ${minVal.toLocaleString("es-CO")} USD para cubrir costos y el margen objetivo.`);
      issues.add(`Valor del contrato no definido; se requiere negociar un valor mínimo de ${minVal.toLocaleString("es-CO")} USD.`);
    } else {
      const parsedVal = parseNumberLike(next.data.value);
      if (parsedVal !== null) {
        if (parsedVal < minVal) {
          next.analysis.profitability.val = "baja";
          next.analysis.profitability.reason = `El valor contractual (${parsedVal.toLocaleString("es-CO")} USD) no cubre los costos estimados (${cost.toLocaleString("es-CO")} USD) y el margen objetivo (${margin}%).`;
          next.decision.type = "no_recomendado_sin_validacion";
          conditions.add(`El valor del contrato debe incrementarse a mínimo ${minVal.toLocaleString("es-CO")} USD.`);
          conditions.add("Establecer garantías de pago y plazos fijos.");
          conditions.add("Revisar penalidades por mora para mitigar riesgo de pérdidas.");
          issues.add(`El valor extraído (${parsedVal.toLocaleString("es-CO")} USD) es inferior al valor mínimo requerido (${minVal.toLocaleString("es-CO")} USD).`);
        }
      } else {
        next.decision.type = "firmar_con_condiciones";
        issues.add("No se pudo comprobar numéricamente el valor del contrato contra el valor mínimo requerido.");
      }
    }
  }

  next.issues = Array.from(issues).filter(Boolean).slice(0, 5); // Limit to max 5 issues as per BLOQUE 3 rules
  next.decision.conditions = Array.from(conditions).filter(Boolean);
  
  // Resolve recommendation decision if not already overridden (e.g. no_recomendado_sin_validacion or firmar_con_condiciones from above)
  if (next.decision.type !== "no_recomendado_sin_validacion" && next.decision.type !== "firmar_con_condiciones") {
    next.decision.type = resolveRecommendation(next);
  }
  
  next.decision.recommendation = resolveReason(next);

  return next;
}

export function parseNumberLike(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "");

  if (!cleaned) {
    return null;
  }

  let normalized = cleaned;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized
      .split(thousandSeparator)
      .join("")
      .replace(decimalSeparator, ".");
  } else if (hasComma) {
    const parts = normalized.split(",");
    normalized =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0]}.${parts[1]}`
        : parts.join("");
  } else if (hasDot) {
    const parts = normalized.split(".");
    normalized =
      parts.length === 2 && parts[1].length <= 2
        ? normalized
        : parts.join("");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function isValueMissing(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    !normalized ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "no encontrado" ||
    normalized.includes("not defined") ||
    normalized.includes("not specified") ||
    normalized.includes("no definido") ||
    normalized.includes("no especificado")
  );
}

function paymentDependsOnApproval(paymentTerms: string): boolean {
  return /approval|approved|acceptance|accepted|aprobacion|aprobado|aceptacion|recibo a satisfaccion|interventoria|visto bueno/i.test(
    paymentTerms
  );
}

function costsFallOnContractor(contract: ContractAnalysis): boolean {
  const relevantText = [
    contract.data.payment_terms,
    contract.data.policies,
    contract.data.penalties
  ]
    .join(" ")
    .toLowerCase();

  return /all costs|all expenses|costs at contractor|expenses at contractor|todos los costos|todos los gastos|a cargo del contratista|asume el contratista|por cuenta del contratista/i.test(
    relevantText
  );
}

function hasUnilateralTermination(termination: string): boolean {
  return /unilateral|sole discretion|sin previo aviso|en cualquier momento|sin causa|unilaterally/i.test(
    termination
  );
}

function higherRisk(current: Risk, candidate: Risk): Risk {
  return RISK_SCORE[candidate] > RISK_SCORE[current] ? candidate : current;
}

function weakerCashFlow(current: CashFlow, candidate: CashFlow): CashFlow {
  return CASH_FLOW_SCORE[candidate] < CASH_FLOW_SCORE[current] ? candidate : current;
}

function downgradeProfitability(current: Profitability): Profitability {
  if (current === "alta") {
    return "media";
  }

  return "baja";
}

function resolveRecommendation(contract: ContractAnalysis): RecommendationType {
  const profitability = contract.analysis.profitability.val;
  const risk = contract.analysis.risk.val;
  const cash_flow = contract.analysis.cash_flow.val;

  if (risk === "alto" && (profitability === "baja" || cash_flow === "debil")) {
    return "no_recomendado_sin_validacion";
  }

  if (risk === "alto" || profitability === "baja" || cash_flow === "debil") {
    return "firmar_con_condiciones";
  }

  return "firmar";
}

function resolveReason(contract: ContractAnalysis): string {
  const mainIssues = contract.issues.slice(0, 2).join(". ");

  if (mainIssues) {
    return mainIssues.slice(0, 500);
  }

  return "Decisión basada en el valor del contrato, formas de pago, penalidades, pólizas y variables económicas del contratista.";
}

function enrichClauseImpacts(
  contract: ContractAnalysis,
  approvalRequired: boolean,
  contractorCosts: boolean,
  unilateralTerm: boolean
) {
  // Asegurarse de que existan impactos básicos si no los inyectó la IA
  const impacts = contract.clause_impacts;

  const hasPenalties = impacts.some(i => i.clause.toLowerCase().includes("penal"));
  if (!hasPenalties && contract.data.penalties !== "no encontrado") {
    impacts.push({
      clause_number: impacts.length + 1,
      clause: "Penalidades",
      detail: contract.data.penalties,
      severity: "alta",
      financial_impact: "Multas por moras o entregas tardías pueden reducir directamente el margen de ganancia.",
      operational_impact: "Requiere control estricto de cronogramas y entregables para evitar activación de multas.",
      risk_impact: "Exposición financiera alta si se presentan incumplimientos por causas externas."
    });
  }

  const hasTermination = impacts.some(i => i.clause.toLowerCase().includes("termina"));
  if (!hasTermination && contract.data.termination !== "no encontrado") {
    impacts.push({
      clause_number: impacts.length + 1,
      clause: "Terminación Anticipada",
      detail: contract.data.termination,
      severity: unilateralTerm ? "alta" : "media",
      financial_impact: unilateralTerm
        ? "Si el cliente rescinde unilateralmente, pueden quedar costos comprometidos sin recuperar."
        : "La terminación bilateral protege ambas partes, riesgo financiero moderado.",
      operational_impact: "Afecta la planeación de recursos; puede generar capacidad ociosa o retrasos en otros proyectos.",
      risk_impact: unilateralTerm
        ? "El cliente puede rescindir sin compensación, dejando al proveedor expuesto."
        : "Riesgo de continuidad moderado, ambas partes deben acordar la terminación."
    });
  }

  const hasPolicies = impacts.some(i => i.clause.toLowerCase().includes("poliza") || i.clause.toLowerCase().includes("póliza"));
  if (!hasPolicies && contract.data.policies !== "no encontrado") {
    impacts.push({
      clause_number: impacts.length + 1,
      clause: "Pólizas y Garantías",
      detail: contract.data.policies,
      severity: contractorCosts ? "alta" : "media",
      financial_impact: contractorCosts
        ? "El costo total de pólizas corre por cuenta del proveedor, reduciendo directamente el margen."
        : "Aumenta los costos de movilización y suscripción inicial.",
      operational_impact: "Requiere gestión y contratación de pólizas antes del inicio. Demora posible en arranque.",
      risk_impact: "Pólizas no contratadas a tiempo pueden bloquear el inicio del contrato o generar incumplimientos formales."
    });
  }
}

function cloneContractAnalysis(contract: ContractAnalysis): ContractAnalysis {
  return {
    data: {
      parties: typeof contract.data.parties === "object" ? { ...contract.data.parties } : contract.data.parties,
      value: contract.data.value,
      currency: contract.data.currency,
      trm: contract.data.trm,
      duration: contract.data.duration,
      payment_terms: contract.data.payment_terms,
      policies: contract.data.policies,
      penalties: contract.data.penalties,
      termination: contract.data.termination,
      financials_from_po: contract.data.financials_from_po
    },
    analysis: {
      profitability: { ...contract.analysis.profitability },
      risk: { ...contract.analysis.risk },
      cash_flow: { ...contract.analysis.cash_flow }
    },
    issues: [...contract.issues],
    factors_to_sign: { ...contract.factors_to_sign },
    billing_conditions: { ...contract.billing_conditions },
    clause_impacts: contract.clause_impacts.map((ci) => ({ ...ci })),
    decision: {
      recommendation: contract.decision.recommendation,
      type: contract.decision.type,
      conditions: [...contract.decision.conditions],
      minimum_value_required: contract.decision.minimum_value_required
    }
  };
}
