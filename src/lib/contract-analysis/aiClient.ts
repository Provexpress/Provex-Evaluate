import type { BusinessInputs } from "./business";
import {
  normalizeContractAnalysis,
  safeJsonParseObject,
  type ContractAnalysis
} from "./schema";
import type { PreparedContractText } from "./text";

interface AiProviderConfig {
  provider: "openai" | "azure";
  url: string;
  headers: Record<string, string>;
  model?: string;
}

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export async function analyzeContractWithAi({
  preparedText,
  preparedPoText,
  businessInputs
}: {
  preparedText: PreparedContractText;
  preparedPoText?: PreparedContractText;
  businessInputs: BusinessInputs;
}): Promise<ContractAnalysis> {
  const config = getAiProviderConfig();
  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    {
      role: "user",
      content: buildUserPrompt(preparedText, preparedPoText, businessInputs)
    }
  ];

  const requestBody: Record<string, unknown> = {
    messages,
    temperature: 0.1,
    response_format: { type: "json_object" }
  };

  if (config.model) {
    requestBody.model = config.model;
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: config.headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `El proveedor de IA falló con código ${response.status}: ${body.slice(0, 500)}`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("El proveedor de IA retornó una respuesta vacía.");
  }

  return normalizeContractAnalysis(safeJsonParseObject(content));
}

function getAiProviderConfig(): AiProviderConfig {
  const azureEndpoint = env("AZURE_OPENAI_ENDPOINT");
  const azureKey = env("AZURE_OPENAI_API_KEY");
  const azureDeployment = env("AZURE_OPENAI_DEPLOYMENT");
  const hasAnyAzure = Boolean(azureEndpoint || azureKey || azureDeployment);

  if (
    azureEndpoint &&
    azureKey &&
    azureDeployment &&
    !isPlaceholderSecret(azureKey)
  ) {
    const apiVersion = env("AZURE_OPENAI_API_VERSION") || "2024-10-21";
    const baseUrl = azureEndpoint.replace(/\/+$/, "");

    return {
      provider: "azure",
      url: `${baseUrl}/openai/deployments/${encodeURIComponent(
        azureDeployment
      )}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
      headers: {
        "Content-Type": "application/json",
        "api-key": azureKey
      }
    };
  }

  const openAiKey = env("OPENAI_API_KEY");

  if (openAiKey && !isPlaceholderSecret(openAiKey)) {
    return {
      provider: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`
      },
      model: env("CONTRACT_ANALYZER_MODEL") || env("OPENAI_MODEL") || "gpt-4.1-mini"
    };
  }

  if (hasAnyAzure) {
    throw new AiConfigurationError(
      "La configuración de Azure OpenAI está incompleta y no se encuentra OPENAI_API_KEY."
    );
  }

  throw new AiConfigurationError(
    "Configure OPENAI_API_KEY o las variables AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY y AZURE_OPENAI_DEPLOYMENT."
  );
}

function buildUserPrompt(
  preparedText: PreparedContractText,
  preparedPoText: PreparedContractText | undefined,
  businessInputs: BusinessInputs
): string {
  const estimatedCost =
    businessInputs.estimated_cost === undefined
      ? "no provisto"
      : String(businessInputs.estimated_cost);
  const expectedMargin =
    businessInputs.expected_margin === undefined
      ? "no provisto"
      : String(businessInputs.expected_margin);

  const poSection = preparedPoText
    ? `
---

## DOCUMENTO 2: ORDEN DE COMPRA (PO) ASOCIADA
Usa los siguientes datos de la Orden de Compra para complementar o extraer la información financiera (valor, moneda, forma de pago) si no están claros o no se definen en el contrato principal:
${preparedPoText.text}
`
    : "";

  return `
Eres un analista experto en contratos y al mismo tiempo el Director Comercial de una empresa proveedora (contratista).

Tu objetivo NO es resumir el contrato, sino evaluar si es rentable y conveniente firmarlo desde el punto de vista del PROVEEDOR.

El sistema ProvexEvaluate se utiliza para evitar firmar contratos que generen pérdidas o riesgos excesivos.

---

## CONTEXTO DEL NEGOCIO

El usuario puede proveer:
- costo_estimado (USD): ${estimatedCost}
- margen_objetivo (%): ${expectedMargin}

Si esta información está disponible (no es "no provisto"), úsala para calcular la rentabilidad mínima requerida.

---

## ANÁLISIS REQUERIDO

Responde en los siguientes bloques principales dentro del JSON:

---

### BLOQUE 1 — DATOS DEL CONTRATO
Extrae de forma estructurada los siguientes campos. Si no está explícito en el texto del contrato principal ni de la Orden de Compra adjunta, indica estrictamente el valor literal "no encontrado". No inventes información:
- partes (parties): objeto clave-valor o texto que liste las partes contratantes y sus roles (ej: {"contratante": "ACME SAS", "contratista": "PROVEXPRESS SAS"})
- valor (value): valor monetario del contrato (ej: "150.000.000" o "no encontrado")
- moneda (currency): moneda del contrato (ej: "COP", "USD" o "no encontrado")
- TRM (trm): TRM si aplica (ej: "4.200" o "no encontrado")
- duración (duration): duración del contrato (ej: "12 meses" o "no encontrado")
- forma_pago (payment_terms): plazos y condiciones de pago (ej: "60 días" o "no encontrado")
- polizas (policies): Detalle minucioso y desagregado de todas las pólizas de seguros y garantías contractuales requeridas, especificando tipos de amparo (ej. cumplimiento, calidad, salarios), porcentajes o valores de cobertura, vigencias y condiciones de aprobación (si no está, "no encontrado")
- penalidades (penalties): multas y penalidades aplicables (si no está, "no encontrado")
- terminacion (termination): cláusulas de terminación del contrato (si no está, "no encontrado")

*IMPORTANTE*: Si el contrato principal no define el valor o los términos de pago, pero sí se adjunta una Orden de Compra y extraes dichos datos de la Orden de Compra, debes establecer "financials_from_po": true en el JSON. De lo contrario, indica false.

---

### BLOQUE 2 — ANÁLISIS DE NEGOCIO (modo proveedor)
Evalúa y califica con una de las opciones sugeridas, y provee una breve explicación ("reason" de máximo 2 líneas) de por qué se asignó esa calificación:
- rentabilidad (profitability):
  * val: "alta" | "media" | "baja"
  * reason: explicación del porqué.
- riesgo (risk):
  * val: "alto" | "medio" | "bajo"
  * reason: explicación del porqué.
- flujo_caja (cash_flow):
  * val: "fuerte" | "medio" | "debil"
  * reason: explicación del porqué (ej: "Pagos condicionados a la aprobación de facturas los jueves").

---

### BLOQUE 3 — PROBLEMAS CLAVE (issues)
Lista máximo 5 alertas comerciales o riesgos críticos en un arreglo de cadenas.

---

### BLOQUE 4 — CONDICIONES DE FACTURACIÓN (billing_conditions)
Extrae los siguientes detalles de cobro:
- payment_days: días específicos de pago si se mencionan (ej. "Solo los jueves" o "A los 60 días calendario").
- requirements: requisitos documentales o aprobaciones de supervisión (ej. "Acta aprobada por interventor").
- constraints: trabas operativas o plazos límites de radicación.
- cash_flow_impact: análisis de negocio de cómo esto afecta directamente la liquidez del proveedor.

---

### BLOQUE 5 — MOTOR DE IMPACTO DE CLÁUSULAS (clause_impacts)
Analiza el contrato CLÁUSULA POR CLÁUSULA de forma individual. Identifica entre 5 y 10 cláusulas relevantes (no las agrupe, una por objeto en el array).

Foco obligatorio en estas catáategoras:
- Condiciones de pago / plazos
- Penalidades / multas
- Terminación anticipada (unilateral o bilateral)
- Obligaciones del contratista
- Pólizas y garantías requeridas
- Interventoría / supervisión
- Modificaciones y adendas
- Propiedad intelectual o confidencialidad (si aplica)
- Ajuste de precios o revisiones de tarifa
- Resp. civil extracontractual o indemnizaciones

Cada objeto del arreglo DEBE tener:
- clause_number: número secuencial (1, 2, 3...)
- clause: Nombre corto de la cláusula (ej: "Terminación Anticipada", "Plóiza de Cumplimiento").
- detail: Qué dice exactamente la cláusula — texto simplificado, máximo 2-3 oraciones.
- severity: Severidad para el PROVEEDOR: "alta" | "media" | "baja".
- financial_impact: Impacto directo en dinero o rentabilidad (ej: "Puede reducir el margen en un 10% si hay retrasos").
- operational_impact: Impacto en operaciones o ejecución del servicio (ej: "Requiere interventor activo, agrega carga documental").
- risk_impact: Riesgo contractual o legal (ej: "Permite terminación unilateral sin compensación").

REGLA CLAVE: Conecta siempre la cláusula → consecuencia real en el negocio del proveedor. El gerente debe entender POR QUÉ importa.

---

### BLOQUE 6 — FACTORES CLAVE PARA FIRMAR (factors_to_sign)
Describe de forma concisa cada uno de los siguientes factores para que la gerencia evalúe las condiciones de firma:
- minimum_value_required: descripción del valor mínimo requerido para que el negocio sea viable y cubra el margen objetivo.
- payment_conditions: términos o plazos de pago ideales recomendados.
- risk_tolerance: tolerancia comercial sugerida frente a las penalidades.
- cost_coverage: viabilidad de la cobertura de costos.
- operational_requirements: requisitos del personal o entregables mínimos requeridos.

---

### BLOQUE 7 — MOTOR DE DECISIÓN DE PÓLIZAS Y GARANTÍAS (policies_analysis)
Actúa como un asesor financiero y contractual experto. Evalúa la aplicabilidad e impacto de pólizas de seguros y garantías para el contratista, distinguiendo explícitamente entre las exigidas contractualmente y las sugeridas analíticamente:
- does_apply: Booleano (true/false) que indica si se requiere constituir pólizas o garantías en general.
- required_status: "Pólizas requeridas" si el contrato de forma obligatoria exige constituir garantías (o si se sugiere por el contexto del negocio), o "Pólizas no requeridas" en caso contrario.
- are_policies_required_by_contract: Booleano (true/false) que indica si el contrato exige explícitamente y por escrito constituir pólizas de seguro.
- is_policy_type_defined: Booleano (true/false) que indica si el contrato define explícitamente qué tipo o ramos de pólizas se deben constituir (ej: cumplimiento, responsabilidad civil, salarios, etc.).
- is_policy_amount_defined: Booleano (true/false) que indica si el contrato define explícitamente los montos, límites de cobertura o porcentajes requeridos para las pólizas.
- required_policies_text: Detalle textual de lo que exige el contrato respecto a seguros. Si are_policies_required_by_contract es true pero el contrato no define el tipo ni el monto en el texto, debes escribir exactamente: "El contrato exige pólizas, pero no define el tipo ni el monto. Debe validarse con la orden de compra o el cliente."
- policies_list: Arreglo de exactamente 4 objetos correspondientes a estas pólizas estándar: "Póliza de Cumplimiento", "Póliza de Responsabilidad Civil Extracontractual", "Garantía de Calidad y Servicio (Performance)", "Garantía de Buen Manejo de Anticipo".
  Cada objeto debe contener:
  * name: Nombre de la póliza.
  * applies: Booleano (true/false). Indica si aplica o se sugiere para este contrato en específico.
  * is_explicitly_required_by_contract: Booleano (true/false). Indica si esta póliza en particular es exigida explícitamente y por su nombre o tipo en el texto del contrato. Si el contrato exige pólizas de forma genérica (ej. "el contratista constituirá las pólizas necesarias") pero no nombra esta póliza en particular por su tipo/nombre, este campo DEBE ser false. Nunca lo marques como true si solo se infiere por análisis o buenas prácticas.
  * are_values_specified: Booleano (true/false) indicando si el contrato define el monto de cobertura de esta póliza específica.
  * value_details: Detalle de montos si are_values_specified es true, o "Montos no especificados en el contrato" si es false.
  * applies_when: Regla general de cuándo aplica esta póliza (ej. "Se aplica si existen obligaciones contractuales y ejecución de servicios").
  * does_not_apply_when: Regla general de cuándo no aplica esta póliza (ej. "No requerido en contratos de bajo riesgo").
  * estimated_cost: Deja siempre la cadena literal "No calculable" (el backend calculará el costo real dinámicamente).
  * why_applies: Explicación de por qué aplica, no aplica o se sugiere en este contrato en particular según el contexto del servicio.
- business_impact: Objeto con el desglose del impacto comercial estructurado:
  * cost_impact: Cómo afecta al costo operativo general (primas a pagar, etc.).
  * profitability_impact: Cómo impacta directamente a la rentabilidad y al margen neto del contratista.
  * management_effort: Esfuerzo administrativo de consecución, firmas y renovación de las garantías.
- policy_conclusion: Objeto con una conclusión final estructurada:
  * summary: Breve texto explicativo/resumen. Ej: "El contrato no define el tipo de póliza, pero en la práctica se requerirán:".
  * most_likely_required: Arreglo de cadenas indicando cuáles pólizas son de ALTA PROBABILIDAD (realistas) para ser exigidas por el cliente en la práctica (ej: ["Póliza de cumplimiento -> Alta probabilidad"]).
  * likely_required: Arreglo de cadenas indicando cuáles son PROBABLES (ej: ["Póliza de responsabilidad civil -> Probable"]).
  * optional: Arreglo de cadenas indicando cuáles son OPCIONALES (ej: ["Garantía de calidad -> Opcional"]).
  * final_note: Debe ser exactamente: "Debe confirmarse con cliente antes de firma".

---

### BLOQUE 8 — RECOMENDACIÓN DE VIABILIDAD (decision)
Si el contrato no tiene información financiera clara y tampoco hay Orden de Compra:
- NO rechaces automáticamente.
- En su lugar:
  - marcar la recomendación (type) como "firmar_con_condiciones".
  - define las condiciones necesarias en el arreglo "conditions" para que sea viable (ej: ["Garantizar plazos de pago", "Verificar valor del contrato"]).
- type de recomendación: "firmar" | "firmar_con_condiciones" | "no_recomendado_sin_validacion"

${poSection}

---

## FORMATO DE RESPUESTA (OBLIGATORIO JSON)
Devuelve únicamente un objeto JSON que coincida exactamente con la siguiente estructura de claves y valores (no agregues texto fuera del JSON, no uses bloques de código markdown \`\`\`json):
{
  "data": {
    "parties": "",
    "value": "",
    "currency": "",
    "trm": "",
    "duration": "",
    "payment_terms": "",
    "policies": "",
    "penalties": "",
    "termination": "",
    "financials_from_po": false
  },
  "analysis": {
    "profitability": {
      "val": "alta | media | baja",
      "reason": "explicación de máximo 2 líneas"
    },
    "risk": {
      "val": "alto | medio | bajo",
      "reason": "explicación de máximo 2 líneas"
    },
    "cash_flow": {
      "val": "fuerte | medio | debil",
      "reason": "explicación de máximo 2 líneas"
    }
  },
  "issues": [],
  "billing_conditions": {
    "payment_days": "días específicos o plazos",
    "requirements": "aprobaciones e interventoría requeridas",
    "constraints": "restricciones y plazos límites de radicación",
    "cash_flow_impact": "impacto en flujo de caja y liquidez"
  },
  "clause_impacts": [
    {
      "clause_number": 1,
      "clause": "Nombre corto de la cláusula",
      "detail": "Qué dice exactamente la cláusula (simplificado)",
      "severity": "alta | media | baja",
      "financial_impact": "Impacto directo en dinero o rentabilidad",
      "operational_impact": "Impacto en operaciones o ejecución del servicio",
      "risk_impact": "Riesgo contractual o legal para el proveedor"
    }
  ],
  "factors_to_sign": {
    "minimum_value_required": "descripción de valor mínimo",
    "payment_conditions": "descripción de plazos de pago ideales",
    "risk_tolerance": "tolerancia sugerida a multas",
    "cost_coverage": "viabilidad de costos y margen",
    "operational_requirements": "requisitos operativos"
  },
  "policies_analysis": {
    "does_apply": false,
    "required_status": "Pólizas requeridas | Pólizas no requeridas",
    "are_policies_required_by_contract": false,
    "is_policy_type_defined": false,
    "is_policy_amount_defined": false,
    "required_policies_text": "detalle de pólizas obligatorias o texto de advertencia",
    "policies_list": [
      {
        "name": "Póliza de Cumplimiento",
        "applies": false,
        "is_explicitly_required_by_contract": false,
        "are_values_specified": false,
        "value_details": "detalle de montos o Montos no especificados en el contrato",
        "applies_when": "condición general cuando aplica",
        "does_not_apply_when": "condición general cuando no aplica",
        "estimated_cost": "No calculable",
        "why_applies": "explicación específica de aplicabilidad para este contrato"
      }
    ],
    "business_impact": {
      "cost_impact": "impacto en costos operativos",
      "profitability_impact": "impacto en margen de ganancia",
      "management_effort": "esfuerzo de gestión y renovación"
    },
    "policy_conclusion": {
      "summary": "Breve resumen explicativo (ej. El contrato no define el tipo de póliza, pero en la práctica se requerirán:)",
      "most_likely_required": ["póliza 1 -> Alta probabilidad"],
      "likely_required": ["póliza 2 -> Probable"],
      "optional": ["póliza 3 -> Opcional"],
      "final_note": "Debe confirmarse con cliente antes de firma"
    }
  },
  "decision": {
    "recommendation": "explicación del veredicto comercial en máximo 5 líneas",
    "type": "firmar | firmar_con_condiciones | no_recomendado_sin_validacion",
    "conditions": [
      "condición 1",
      "condición 2"
    ],
    "minimum_value_required": "valor calculado o vacío si no hay parámetros"
  }
}

---

## REGLAS FINALES
- Sé directo y claro.
- NO uses lenguaje jurídico complejo.
- Prioriza dinero, riesgo y flujo de caja.
- Devuelve siempre JSON válido.
- No expliques fuera del JSON.

Texto del contrato original:
${preparedText.text}
`.trim();
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function isPlaceholderSecret(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  return /^(sk-\.\.\.|your-|changeme|replace-me|example|test)$/i.test(value.trim());
}

const SYSTEM_PROMPT = `
Eres un analista experto en contratos y al mismo tiempo el Director Comercial de una empresa proveedora (contratista).
Tu objetivo NO es resumir el contrato, sino evaluar si es rentable y conveniente firmarlo desde el punto de vista del PROVEEDOR.
Debes responder SIEMPRE con un objeto JSON compacto que coincida exactamente con la estructura solicitada. No agregues explicaciones fuera del JSON, no uses bloques de código markdown (\`\`\`json).
`.trim();
