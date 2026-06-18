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
  businessInputs
}: {
  preparedText: PreparedContractText;
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
      content: buildUserPrompt(preparedText, businessInputs)
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

Responde en 4 bloques:

---

### BLOQUE 1 — DATOS DEL CONTRATO
Extrae de forma estructurada los siguientes campos. Si no está explícito en el texto del contrato, indica estrictamente el valor literal "no encontrado". No inventes información:
- partes (parties): objeto clave-valor o texto que liste las partes contratantes y sus roles (ej: {"contratante": "ACME SAS", "contratista": "PROVEXPRESS SAS"})
- valor (value): valor monetario del contrato (ej: "150.000.000" o "no encontrado")
- moneda (currency): moneda del contrato (ej: "COP", "USD" o "no encontrado")
- TRM (trm): TRM si aplica (ej: "4.200" o "no encontrado")
- duración (duration): duración del contrato (ej: "12 meses" o "no encontrado")
- forma_pago (payment_terms): plazos y condiciones de pago (ej: "60 días" o "no encontrado")
- polizas (policies): pólizas y garantías requeridas (si no está, "no encontrado")
- penalidades (penalties): multas y penalidades aplicables (si no está, "no encontrado")
- terminacion (termination): cláusulas de terminación del contrato (si no está, "no encontrado")

---

### BLOQUE 2 — ANÁLISIS DE NEGOCIO (modo proveedor)
Evalúa y califica con una de las opciones sugeridas:
- rentabilidad (profitability): "alta" | "media" | "baja"
- riesgo (risk): "alto" | "medio" | "bajo"
- flujo_caja (cash_flow): "fuerte" | "medio" | "debil"

Criterios de evaluación:
- si el valor no está definido → bajar certeza de rentabilidad (marcar como rentabilidad "baja")
- si todos los costos recaen en el proveedor → bajar rentabilidad (marcar como rentabilidad "baja")
- si pagos dependen de aprobación → debilitar flujo de caja (marcar como flujo de caja "debil")
- si hay terminación unilateral → aumentar riesgo (marcar como riesgo "alto")
- si hay penalidades o deducciones → aumentar riesgo (marcar como riesgo "alto")

---

### BLOQUE 3 — PROBLEMAS CLAVE
Lista máximo 5 en un arreglo de cadenas:
- riesgos críticos
- condiciones desfavorables
- puntos que puedan afectar rentabilidad o flujo de caja

---

### BLOQUE 4 — RECOMENDACIÓN DE VIABILIDAD
IMPORTANTE:
SI el contrato NO tiene información financiera clara (valor, moneda, etc):
- NO rechaces automáticamente.
- En su lugar:
  - marcar la recomendación (type) como "firmar_con_condiciones"
  - usa costo_estimado y margen_objetivo si están disponibles
  - define condiciones para que sea viable

---

## LÓGICA DE DECISIÓN
Si hay datos suficientes:
- tipo de recomendación (type): "firmar" | "firmar_con_condiciones" | "no_firmar"
Si NO hay datos financieros:
- SIEMPRE usar tipo de recomendación (type): "firmar_con_condiciones"
y definir:
- valor mínimo requerido (minimum_value_required)
- condiciones de pago necesarias (conditions)

---

## CÁLCULO (si hay datos del usuario)
Si se proporciona costo_estimado y margen_objetivo (no son "no provisto"):
Entonces calcula el valor mínimo de la siguiente forma:
valor_minimo = costo_estimado * (1 + margen_objetivo/100)
Usa esto en el campo "minimum_value_required" indicando: "Este contrato solo es viable si el valor es mayor o igual a X USD" (donde X es el valor calculado).

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
    "termination": ""
  },
  "analysis": {
    "profitability": "alta | media | baja",
    "risk": "alto | medio | bajo",
    "cash_flow": "fuerte | medio | debil"
  },
  "issues": [],
  "decision": {
    "recommendation": "explicación de la decisión en lenguaje simple y directo de máximo 5 líneas",
    "type": "firmar | firmar_con_condiciones | no_firmar",
    "conditions": "condiciones necesarias si aplica, de lo contrario vacío",
    "minimum_value_required": "valor calculado o vacío si no hay parámetros"
  }
}

---

## REGLAS FINALES
- Sé directo y claro.
- NO uses lenguaje jurídico complejo.
- Prioriza dinero, riesgo y flujo de caja.
- Piensa como negocio, no como abogado.
- Siempre devuelve JSON válido.
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
