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

  // Check missing value
  const valMissing = isValueMissing(next.data.value);
  if (valMissing) {
    next.analysis.risk = higherRisk(next.analysis.risk, "alto");
    next.analysis.cash_flow = weakerCashFlow(next.analysis.cash_flow, "debil");
    issues.add("El valor del contrato no está definido; no se pueden validar los ingresos ni el margen.");
  }

  // Payment approval logic
  if (paymentDependsOnApproval(next.data.payment_terms)) {
    next.analysis.cash_flow = weakerCashFlow(next.analysis.cash_flow, "debil");
    issues.add("El pago depende de aprobación o aceptación; el flujo de caja es más débil.");
  }

  // Costs on contractor logic
  if (costsFallOnContractor(next)) {
    next.analysis.profitability = downgradeProfitability(next.analysis.profitability);
    issues.add("El contrato traslada costos o gastos al contratista.");
  }

  // Unilateral termination logic
  if (hasUnilateralTermination(next.data.termination)) {
    next.analysis.risk = higherRisk(next.analysis.risk, "alto");
    issues.add("La terminación parece unilateral; el riesgo de continuidad para el contratista es alto.");
  }

  // Reintroduce financial calculations
  if (businessInputs && businessInputs.estimated_cost !== undefined && businessInputs.expected_margin !== undefined) {
    const cost = businessInputs.estimated_cost;
    const margin = businessInputs.expected_margin;
    const minVal = cost * (1 + margin / 100);
    
    next.decision.minimum_value_required = `${minVal.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD`;
    
    if (valMissing) {
      next.decision.type = "firmar_con_condiciones";
      if (!next.decision.conditions || next.decision.conditions === "no encontrado") {
        next.decision.conditions = `Definir un valor de contrato de al menos ${minVal.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD para cubrir costos y margen objetivo.`;
      }
      issues.add("Valor del contrato no encontrado; se requiere negociar un valor mínimo de " + minVal.toLocaleString("es-CO") + " USD.");
    } else {
      const parsedVal = parseNumberLike(next.data.value);
      if (parsedVal !== null) {
        if (parsedVal < minVal) {
          next.analysis.profitability = "baja";
          next.decision.type = "no_firmar";
          issues.add(`El valor extraído (${parsedVal.toLocaleString("es-CO")} USD) es inferior al valor mínimo requerido (${minVal.toLocaleString("es-CO")} USD).`);
        }
      } else {
        // Can't parse numeric value
        next.decision.type = "firmar_con_condiciones";
        issues.add("No se pudo comprobar numéricamente el valor del contrato contra el valor mínimo requerido.");
      }
    }
  }

  next.issues = Array.from(issues).filter(Boolean).slice(0, 5); // Limit to max 5 issues as per BLOQUE 3 rules
  
  // Resolve recommendation decision if not already overridden (e.g. no_firmar or firmar_con_condiciones from above)
  if (next.decision.type !== "no_firmar" && next.decision.type !== "firmar_con_condiciones") {
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
  const { profitability, risk, cash_flow } = contract.analysis;

  if (risk === "alto" && (profitability === "baja" || cash_flow === "debil")) {
    return "no_firmar";
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
      termination: contract.data.termination
    },
    analysis: {
      profitability: contract.analysis.profitability,
      risk: contract.analysis.risk,
      cash_flow: contract.analysis.cash_flow
    },
    issues: [...contract.issues],
    decision: {
      recommendation: contract.decision.recommendation,
      type: contract.decision.type,
      conditions: contract.decision.conditions,
      minimum_value_required: contract.decision.minimum_value_required
    }
  };
}
