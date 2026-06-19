"use client";

import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { ContractAnalysis, ClauseImpact } from "@/lib/contract-analysis/schema";

const decisionClassMap: Record<string, string> = {
  firmar: "sign",
  firmar_con_condiciones: "conditional",
  no_recomendado_sin_validacion: "do_not_sign"
};

type ReportBuildInput = {
  analysis: ContractAnalysis;
  contractFileName?: string;
  purchaseOrderFileName?: string;
  estimatedCost?: string;
  expectedMargin?: string;
};

const EMPTY_REPORT_VALUES = new Set([
  "",
  "no encontrado",
  "no especificado",
  "no especificada",
  "no especificadas",
  "no determinado",
  "no determinada",
  "no determinadas",
  "no aplica",
  "n/a"
]);

function isUsefulReportText(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return !EMPTY_REPORT_VALUES.has(value.trim().toLowerCase());
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function reportValue(value: unknown, fallback = "No especificado"): string {
  return isUsefulReportText(value) ? escapeHtml(value) : fallback;
}

function addUniqueReportItem(items: string[], value: unknown): void {
  if (!isUsefulReportText(value)) {
    return;
  }

  const normalized = value.trim();
  if (!items.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
    items.push(normalized);
  }
}

function renderReportList(items: string[], emptyText: string): string {
  const safeItems = items.filter(isUsefulReportText);

  if (safeItems.length === 0) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return `<ul>${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderReportRows(rows: Array<[string, unknown]>): string {
  return rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${reportValue(value)}</td></tr>`
    )
    .join("");
}

function formatReportParties(parties: ContractAnalysis["data"]["parties"]): string {
  if (typeof parties === "string") {
    return isUsefulReportText(parties) ? parties : "No especificado";
  }

  const entries = Object.entries(parties);
  if (entries.length === 0) {
    return "No especificado";
  }

  return entries
    .map(([role, name]) => `${role}: ${name}`)
    .join("; ");
}

function safeReportFileName(value: string): string {
  return (
    value
      .replace(/\.pdf$/i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "contrato"
  ).toLowerCase();
}

function getDecisionLabel(type: ContractAnalysis["decision"]["type"]): string {
  if (type === "firmar") return "Aprobado para firmar";
  if (type === "no_recomendado_sin_validacion") return "No recomendado sin validacion";
  return "Firmar con condiciones";
}

function collectImprovementItems(analysis: ContractAnalysis): string[] {
  const items: string[] = [];

  if (!isUsefulReportText(analysis.data.value)) {
    addUniqueReportItem(items, "Definir valor contractual, moneda y alcance economico antes de aprobar la firma.");
  }

  if (analysis.analysis.profitability.val !== "alta") {
    addUniqueReportItem(items, `Mejorar rentabilidad: ${analysis.analysis.profitability.reason}`);
  }

  if (analysis.analysis.risk.val !== "bajo") {
    addUniqueReportItem(items, `Reducir riesgo contractual: ${analysis.analysis.risk.reason}`);
  }

  if (analysis.analysis.cash_flow.val !== "fuerte") {
    addUniqueReportItem(items, `Fortalecer flujo de caja: ${analysis.analysis.cash_flow.reason}`);
  }

  analysis.issues.forEach((issue) => addUniqueReportItem(items, issue));
  analysis.decision.conditions.forEach((condition) => addUniqueReportItem(items, condition));

  if (isUsefulReportText(analysis.factors_to_sign.payment_conditions)) {
    addUniqueReportItem(items, `Negociar condiciones de pago: ${analysis.factors_to_sign.payment_conditions}`);
  }

  if (isUsefulReportText(analysis.factors_to_sign.cost_coverage)) {
    addUniqueReportItem(items, `Validar cobertura de costos: ${analysis.factors_to_sign.cost_coverage}`);
  }

  if (
    analysis.policies_analysis.are_policies_required_by_contract &&
    (!analysis.policies_analysis.is_policy_type_defined ||
      !analysis.policies_analysis.is_policy_amount_defined)
  ) {
    addUniqueReportItem(items, "Definir tipo, monto, vigencia y costo de polizas antes de firmar.");
  }

  addUniqueReportItem(items, analysis.policies_analysis.policy_conclusion.final_note);

  analysis.clause_impacts
    .filter((clause) => clause.severity === "alta")
    .slice(0, 5)
    .forEach((clause) => {
      addUniqueReportItem(
        items,
        `Revisar clausula "${clause.clause}": ${clause.financial_impact || clause.risk_impact}`
      );
    });

  return items.slice(0, 14);
}

function buildContractReportHtml({
  analysis,
  contractFileName,
  purchaseOrderFileName,
  estimatedCost,
  expectedMargin
}: ReportBuildInput): string {
  const reportDate = new Date().toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const improvementItems = collectImprovementItems(analysis);
  const requiredPolicies = analysis.policies_analysis.policies_list.filter(
    (policy) => policy.is_explicitly_required_by_contract
  );
  const suggestedPolicies = analysis.policies_analysis.policies_list.filter(
    (policy) => !policy.is_explicitly_required_by_contract && policy.applies
  );
  const highClauses = analysis.clause_impacts.filter((clause) => clause.severity === "alta");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe de analisis contractual</title>
  <style>
    body { margin: 0; padding: 40px; color: #172033; background: #f3f6fd; font-family: Arial, sans-serif; line-height: 1.55; }
    main { max-width: 980px; margin: 0 auto; background: #fff; border: 1px solid #d7e0f0; border-radius: 16px; padding: 32px; box-shadow: 0 16px 44px rgba(26,43,107,0.10); }
    h1, h2, h3 { margin: 0; color: #1a2b6b; line-height: 1.2; }
    h1 { font-size: 28px; }
    h2 { margin-top: 30px; padding-bottom: 8px; border-bottom: 1px solid #d7e0f0; font-size: 18px; }
    h3 { margin-top: 18px; font-size: 15px; }
    p { margin: 8px 0; }
    .meta { margin-top: 8px; color: #677592; font-size: 13px; }
    .hero { margin-top: 24px; padding: 20px; border-radius: 12px; background: #eef3ff; border-left: 5px solid #1565c0; }
    .hero strong { display: block; margin-bottom: 6px; color: #1a2b6b; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
    .metric { padding: 14px; border: 1px solid #d7e0f0; border-radius: 10px; background: #fafcff; }
    .metric span { display: block; color: #677592; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .metric strong { display: block; margin: 4px 0; color: #1a2b6b; font-size: 18px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { padding: 10px 12px; border: 1px solid #d7e0f0; text-align: left; vertical-align: top; }
    th { width: 230px; color: #2f437f; background: #f4f7ff; }
    ul { margin: 10px 0 0; padding-left: 20px; }
    li { margin-bottom: 7px; }
    .warning { padding: 16px; border: 1px solid #f0a020; border-radius: 10px; background: #fff7e8; }
    .muted { color: #677592; font-style: italic; }
    .small { color: #677592; font-size: 12px; }
    @media print { body { background: #fff; padding: 0; } main { box-shadow: none; border: none; } }
  </style>
</head>
<body>
  <main>
    <h1>Informe de analisis contractual</h1>
    <p class="meta">Generado por ProvexEvaluate el ${escapeHtml(reportDate)}</p>
    <p class="meta">Contrato: ${reportValue(contractFileName)}${purchaseOrderFileName ? ` | Orden de compra: ${reportValue(purchaseOrderFileName)}` : ""}</p>

    <section class="hero">
      <strong>${escapeHtml(getDecisionLabel(analysis.decision.type))}</strong>
      <p>${reportValue(analysis.decision.recommendation)}</p>
      <p><strong>Valor minimo de viabilidad:</strong> ${reportValue(analysis.decision.minimum_value_required)}</p>
    </section>

    <section>
      <h2>Indicadores ejecutivos</h2>
      <div class="grid">
        <div class="metric"><span>Rentabilidad</span><strong>${escapeHtml(analysis.analysis.profitability.val)}</strong><p>${reportValue(analysis.analysis.profitability.reason)}</p></div>
        <div class="metric"><span>Riesgo</span><strong>${escapeHtml(analysis.analysis.risk.val)}</strong><p>${reportValue(analysis.analysis.risk.reason)}</p></div>
        <div class="metric"><span>Flujo de caja</span><strong>${escapeHtml(analysis.analysis.cash_flow.val)}</strong><p>${reportValue(analysis.analysis.cash_flow.reason)}</p></div>
      </div>
    </section>

    <section>
      <h2>Aspectos a mejorar</h2>
      <div class="warning">
        ${renderReportList(improvementItems, "No se identificaron mejoras criticas adicionales.")}
      </div>
    </section>

    <section>
      <h2>Condiciones para aprobar</h2>
      ${renderReportList(analysis.decision.conditions, "Sin condiciones adicionales reportadas.")}
    </section>

    <section>
      <h2>Datos extraidos del acuerdo</h2>
      <table>
        <tbody>
          ${renderReportRows([
            ["Partes", formatReportParties(analysis.data.parties)],
            ["Valor", `${analysis.data.value} ${analysis.data.currency}`],
            ["TRM", analysis.data.trm],
            ["Duracion", analysis.data.duration],
            ["Condiciones de pago", analysis.data.payment_terms],
            ["Polizas y garantias", analysis.data.policies],
            ["Penalidades", analysis.data.penalties],
            ["Terminacion", analysis.data.termination],
            ["Costo estimado", estimatedCost],
            ["Margen esperado", expectedMargin]
          ])}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Alertas de riesgo</h2>
      ${renderReportList(analysis.issues, "No se reportaron alertas relevantes.")}
    </section>

    <section>
      <h2>Facturacion y flujo de caja</h2>
      <table>
        <tbody>
          ${renderReportRows([
            ["Dias de pago", analysis.billing_conditions.payment_days],
            ["Requisitos", analysis.billing_conditions.requirements],
            ["Restricciones", analysis.billing_conditions.constraints],
            ["Impacto en flujo", analysis.billing_conditions.cash_flow_impact]
          ])}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Polizas y garantias</h2>
      <p><strong>Estado:</strong> ${reportValue(analysis.policies_analysis.required_status)}</p>
      <p><strong>Conclusion:</strong> ${reportValue(analysis.policies_analysis.policy_conclusion.summary)}</p>
      <h3>Exigidas por contrato</h3>
      ${renderReportList(requiredPolicies.map((policy) => `${policy.name}: ${policy.value_details}`), "No se identificaron polizas exigidas por nombre o tipo.")}
      <h3>Sugeridas por analisis</h3>
      ${renderReportList(suggestedPolicies.map((policy) => `${policy.name}: ${policy.estimated_cost}`), "No se identificaron polizas sugeridas adicionales.")}
      <table>
        <tbody>
          ${renderReportRows([
            ["Impacto en costos", analysis.policies_analysis.business_impact.cost_impact],
            ["Impacto en rentabilidad", analysis.policies_analysis.business_impact.profitability_impact],
            ["Esfuerzo de gestion", analysis.policies_analysis.business_impact.management_effort]
          ])}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Clausulas criticas</h2>
      ${renderReportList(
        highClauses.map((clause) => `${clause.clause}: ${clause.financial_impact || clause.risk_impact}`),
        "No se reportaron clausulas de severidad alta."
      )}
    </section>

    <p class="small">Este informe es una herramienta de apoyo a la decision comercial. Debe validarse con gerencia, juridica y el cliente antes de firmar.</p>
  </main>
</body>
</html>`;
}

function renderReportOffscreen(html: string): HTMLDivElement {
  const container = document.createElement("div");
  container.setAttribute("data-px-report-canvas", "true");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "980px";
  container.style.background = "#fff";
  container.style.zIndex = "-1";
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

async function downloadReportAsPdf(html: string, fileName: string): Promise<void> {
  const container = renderReportOffscreen(html);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const printableWidth = pageWidth - margin * 2;
    const totalHeight = (canvas.height * printableWidth) / canvas.width;

    if (totalHeight <= pageHeight - margin * 2) {
      pdf.addImage(imgData, "PNG", margin, margin, printableWidth, totalHeight);
    } else {
      const sliceHeightPx = ((pageHeight - margin * 2) * canvas.width) / printableWidth;
      let yOffset = 0;

      while (yOffset < canvas.height) {
        const sliceHeight = Math.min(sliceHeightPx, canvas.height - yOffset);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        if (!ctx) {
          break;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          yOffset,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        const sliceImg = pageCanvas.toDataURL("image/png");
        const sliceHeightMm = (sliceHeight * printableWidth) / canvas.width;

        if (yOffset > 0) {
          pdf.addPage();
        }
        pdf.addImage(sliceImg, "PNG", margin, margin, printableWidth, sliceHeightMm);
        yOffset += sliceHeight;
      }
    }

    pdf.save(fileName);
  } finally {
    container.remove();
  }
}


export default function Home() {
  // Estado del archivo de contrato y arrastre
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado del archivo de orden de compra
  const [purchaseOrderFile, setPurchaseOrderFile] = useState<File | null>(null);

  // Parámetros financieros del negocio
  const [estimatedCost, setEstimatedCost] = useState<string>("");
  const [expectedMargin, setExpectedMargin] = useState<string>("");

  // Carga y estado de barra
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusIndex, setStatusIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);

  // Estado para acordeón de cláusulas analizadas
  const [expandedClauses, setExpandedClauses] = useState<Record<number, boolean>>({});

  const toggleClause = (idx: number) => {
    setExpandedClauses((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const expandAllClauses = (clausesCount: number) => {
    const nextState: Record<number, boolean> = {};
    for (let i = 0; i < clausesCount; i++) {
      nextState[i] = true;
    }
    setExpandedClauses(nextState);
  };

  const collapseAllClauses = () => {
    setExpandedClauses({});
  };


  const loadingStatuses = [
    "Leyendo el archivo PDF del contrato...",
    "Extrayendo la estructura de texto del documento...",
    "Analizando las partes contratantes y sus obligaciones...",
    "Evaluando heurísticas de riesgo legal y financiero...",
    "Contrastando cláusulas con las reglas de negocio...",
    "Compilando la recomendación comercial para la junta directiva...",
    "Finalizando reporte para la revisión de la Gerencia..."
  ];

  // Rotar textos de estado durante carga
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setStatusIndex((prevIndex) => (prevIndex + 1) % loadingStatuses.length);
      }, 3000);
    } else {
      setStatusIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Eventos de arrastre para contrato
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (files: File[]) => {
    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfs.length === 0) {
      setError("Únicamente se soportan archivos PDF para la evaluación.");
      return;
    }

    setError(null);

    if (pdfs.length >= 2) {
      // Intentar clasificar cuál es el contrato y cuál es la orden de compra (PO)
      const poKeywords = ["orden", "compra", "po", "odc", "pedido"];
      const isPo = (f: File) => poKeywords.some((kw) => f.name.toLowerCase().includes(kw));

      const firstIsPo = isPo(pdfs[0]);
      const secondIsPo = isPo(pdfs[1]);

      if (firstIsPo && !secondIsPo) {
        setPurchaseOrderFile(pdfs[0]);
        setFile(pdfs[1]);
      } else if (!firstIsPo && secondIsPo) {
        setFile(pdfs[0]);
        setPurchaseOrderFile(pdfs[1]);
      } else {
        // Por descarte, el archivo más grande suele ser el contrato principal
        if (pdfs[0].size >= pdfs[1].size) {
          setFile(pdfs[0]);
          setPurchaseOrderFile(pdfs[1]);
        } else {
          setFile(pdfs[1]);
          setPurchaseOrderFile(pdfs[0]);
        }
      }
    } else {
      // Un solo archivo
      setFile(pdfs[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePoFile = () => {
    setPurchaseOrderFile(null);
  };

  // Enviar archivos a la API con costos y márgenes
  const handleAnalyze = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    const formData = new FormData();
    formData.append("file", file);
    if (purchaseOrderFile) {
      formData.append("purchase_order", purchaseOrderFile);
    }
    if (estimatedCost.trim()) {
      formData.append("estimated_cost", estimatedCost.trim());
    }
    if (expectedMargin.trim()) {
      formData.append("expected_margin", expectedMargin.trim());
    }

    try {
      const response = await fetch("/api/analyze-contract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || `Error en el servicio (${response.status})`);
      }

      setAnalysis(data);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado al analizar el contrato.");
    } finally {
      setIsLoading(false);
    }
  };

  // Limpiar panel
  const handleReset = () => {
    setFile(null);
    setPurchaseOrderFile(null);
    setAnalysis(null);
    setError(null);
    setEstimatedCost("");
    setExpectedMargin("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Renderizar y formatear las partes contratantes de forma limpia
  const renderParties = (parties: Record<string, string> | string) => {
    let parsed: Record<string, string> | null = null;
    if (typeof parties === "string") {
      const trimmed = parties.trim();
      if (trimmed.startsWith("{")) {
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          // No es un objeto JSON parseable
        }
      }
    } else if (parties && typeof parties === "object") {
      parsed = parties;
    }

    if (parsed && Object.keys(parsed).length > 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-space-1)" }}>
          {Object.entries(parsed).map(([role, name], idx) => (
            <div key={idx} style={{ fontSize: "var(--px-text-sm)" }}>
              <span style={{ fontWeight: "bold", textTransform: "capitalize" }}>{role}: </span>
              <span>{name}</span>
            </div>
          ))}
        </div>
      );
    }

    // Texto plano ordinario
    const displayVal = typeof parties === "string" ? parties : JSON.stringify(parties);
    if (!displayVal || displayVal === "no encontrado" || displayVal === "{}") {
      return <span style={{ color: "var(--px-muted)", fontStyle: "italic" }}>no encontrado</span>;
    }

    return <span>{displayVal}</span>;
  };

  const handleDownloadReport = async () => {
    if (!analysis) {
      return;
    }

    const html = buildContractReportHtml({
      analysis,
      contractFileName: file?.name,
      purchaseOrderFileName: purchaseOrderFile?.name,
      estimatedCost: estimatedCost.trim() || undefined,
      expectedMargin: expectedMargin.trim() || undefined
    });
    const today = new Date().toISOString().slice(0, 10);
    const baseName = safeReportFileName(file?.name || "contrato");

    try {
      await downloadReportAsPdf(html, `informe-${baseName}-${today}.pdf`);
    } catch (error) {
      console.error("No se pudo generar el PDF del informe", error);
      window.alert("No se pudo generar el PDF del informe. Intentalo de nuevo.");
    }
  };

  return (
    <main className="px-shell px-shell--dashboard px-stack">
      {/* Barra superior del sistema */}
      <header className="px-topbar">
        <div className="px-brand">
          <div className="px-logo px-logo--sm" style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <img 
              src="/provex-logo.jpeg" 
              alt="Provex Logo" 
              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
            />
          </div>
          <div className="px-brand__meta">
            <p className="px-eyebrow">Evaluación Contractual</p>
            <h1 className="px-brand__title">ProvexEvaluate</h1>
            <p className="px-brand__subtitle">Panel de Decisión Comercial - Lado Proveedor</p>
          </div>
        </div>
        <div className="px-actions">
          {analysis && (
            <button className="px-btn px-btn--secondary px-btn--sm" onClick={handleDownloadReport}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Descargar informe
            </button>
          )}
          {(analysis || file || purchaseOrderFile || estimatedCost || expectedMargin) && (
            <button className="px-btn px-btn--ghost px-btn--sm" onClick={handleReset}>
              Restablecer Panel
            </button>
          )}
        </div>
      </header>

      {/* Estructura Workbench (Sidebar + Dashboard) */}
      <div className="px-workbench">
        {/* Panel lateral con carga de archivo y parámetros */}
        <aside className="px-sidebar px-anim-enter">

          {/* ── SECCIÓN 1: DOCUMENTOS ── */}
          <div className="px-sidebar-section">
            <div className="px-sidebar-section-header">
              <span className="px-sidebar-step">01</span>
              <div>
                <p className="px-sidebar-label">Documentos</p>
                <h2 className="px-sidebar-title">Origen del Contrato</h2>
              </div>
            </div>

            {/* Contrato */}
            <div className="px-field">
              <label className="px-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display:"inline", marginRight:"5px", verticalAlign:"middle" }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Contrato Principal (PDF)
              </label>
              {!file ? (
                <div
                  className={`px-upload-zone ${dragActive ? "drag-over" : ""}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileSelect}
                >
                  <div className="px-upload-icon-circle">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className="px-upload-title">Subir Documentos PDF</p>
                  <p className="px-upload-subtitle">Arrastra o haz clic (puedes subir contrato y orden de compra juntos)</p>
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={handleFileChange} />
                </div>
              ) : (
                <div className="px-file-card">
                  <div className="px-file-icon">PDF</div>
                  <div className="px-file-info">
                    <p className="px-file-name" title={file.name}>{file.name}</p>
                    <p className="px-file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button className="px-btn px-btn--ghost px-btn--sm px-btn--icon px-file-remove" onClick={removeFile} disabled={isLoading} title="Eliminar contrato">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Orden de Compra */}
            {purchaseOrderFile && (
              <div className="px-field">
                <label className="px-label">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display:"inline", marginRight:"5px", verticalAlign:"middle" }}>
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="12" y2="17" />
                  </svg>
                  Orden de Compra
                </label>
                <div className="px-file-card px-file-card--po">
                  <div className="px-file-icon px-file-icon--po">O/C</div>
                  <div className="px-file-info">
                    <p className="px-file-name" title={purchaseOrderFile.name}>{purchaseOrderFile.name}</p>
                    <p className="px-file-size">{(purchaseOrderFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button className="px-btn px-btn--ghost px-btn--sm px-btn--icon px-file-remove" onClick={removePoFile} disabled={isLoading} title="Eliminar orden de compra">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>



          {/* ── DIVIDER + CTA ── */}
          {file && !analysis && (
            <>
              <div className="px-sidebar-divider"></div>
              <div className="px-sidebar-cta">
                <button
                  className="px-btn px-btn--primary"
                  onClick={handleAnalyze}
                  disabled={isLoading}
                  style={{ width:"100%", minHeight:"50px", fontSize:"var(--px-text-base)", borderRadius:"var(--px-radius-lg)" }}
                >
                  <span>Evaluar Riesgo Comercial</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
                <p className="px-sidebar-hint">⚡ Análisis en ~20 segundos con IA</p>
              </div>
            </>
          )}
        </aside>

        {/* Panel principal de resultados */}
        <section className="px-stack" style={{ gap: "var(--px-space-4)" }}>
          {/* Alerta de Error */}
          {error && (
            <div className="px-alert px-alert--danger" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span><strong>Error de Análisis:</strong> {error}</span>
              <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1.2rem", fontWeight: "bold" }} onClick={() => setError(null)}>×</button>
            </div>
          )}

          {/* Pantalla de Carga */}
          {isLoading && (
            <div className="px-panel px-loader-wrapper">
              <div className="px-loader-spinner">
                <div className="px-loader-ring-inner"></div>
              </div>
              <h3 className="px-loader-title">Analizando cláusulas del contrato...</h3>
              <p className="px-loader-subtitle">{loadingStatuses[statusIndex]}</p>
              <div className="px-loader-dots">
                <div className="px-loader-dot"></div>
                <div className="px-loader-dot"></div>
                <div className="px-loader-dot"></div>
              </div>
            </div>
          )}

          {/* Estado Inicial / Vacío */}
          {!isLoading && !analysis && (
            <div className="px-panel px-empty-view">
              <div className="px-empty-icon">⚖️</div>
              <h2 className="px-title" style={{ fontFamily: "var(--px-font-display)", fontSize: "var(--px-text-panel)", marginBottom: "var(--px-space-2)" }}>Centro de Decisiones y Riesgos Comerciales</h2>
              <p className="px-copy" style={{ margin: "0", lineHeight: 1.65 }}>
                Sube un contrato de servicios en formato PDF. El motor financiero y comercial de IA auditará los plazos de pago, multas, pólizas, indemnizaciones y terminaciones unilaterales para entregar una decisión automática.
              </p>
              
              <div className="px-features-row">
                <div className="px-feature-box px-anim-enter px-anim-enter--1">
                  <p className="px-feature-num">01</p>
                  <h4 className="px-feature-title">Validar Liquidez</h4>
                  <p className="px-feature-desc">Evalúa plazos de pago, dependencias de firmas y riesgos en el flujo de caja.</p>
                </div>
                <div className="px-feature-box px-anim-enter px-anim-enter--2">
                  <p className="px-feature-num">02</p>
                  <h4 className="px-feature-title">Auditar Alertas</h4>
                  <p className="px-feature-desc">Detecta penalidades excesivas, pólizas requeridas y cláusulas unilaterales.</p>
                </div>
                <div className="px-feature-box px-anim-enter px-anim-enter--3">
                  <p className="px-feature-num">03</p>
                  <h4 className="px-feature-title">Veredicto de Viabilidad</h4>
                  <p className="px-feature-desc">Obtén una recomendación clara sobre la viabilidad y conveniencia de firmar el acuerdo.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tablero de Decisiones y Resultados */}
          {!isLoading && analysis && (
            <div className="px-results-stack" style={{ display: "flex", flexDirection: "column", gap: "var(--px-space-6)" }}>
              <div className="px-report-actions px-anim-enter">
                <div>
                  <h3 className="px-report-actions__title">Informe de análisis listo</h3>
                  <p className="px-report-actions__copy">Incluye decisión, riesgos, pólizas, cláusulas y aspectos a mejorar.</p>
                </div>
                <button className="px-btn px-btn--primary" onClick={handleDownloadReport}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Descargar informe
                </button>
              </div>

              {/* 🔴 1. HERO DECISION (TOP) */}
              <div className={`px-hero-decision px-hero-decision--${decisionClassMap[analysis.decision.type] || "conditional"} px-anim-enter`}>
                {analysis.data.financials_from_po && (
                  <div style={{ display: "inline-flex", marginBottom: "var(--px-space-2)" }}>
                    <span className="px-badge px-badge--success" style={{ textTransform: "none", fontSize: "var(--px-text-xs)" }}>
                      💡 Datos financieros extraídos de la Orden de Compra
                    </span>
                  </div>
                )}
                
                <div className="px-hero-decision__header">
                  <div className="px-hero-decision__icon">
                    {analysis.decision.type === "firmar" && "✅"}
                    {analysis.decision.type === "firmar_con_condiciones" && "⚠️"}
                    {analysis.decision.type === "no_recomendado_sin_validacion" && "❌"}
                  </div>
                  <div>
                    <span className="px-hero-decision__eyebrow">Recomendación Directiva</span>
                    <h2 className="px-hero-decision__title">
                      {analysis.decision.type === "firmar" && "APROBADO PARA FIRMAR"}
                      {analysis.decision.type === "firmar_con_condiciones" && "FIRMAR CON CONDICIONES"}
                      {analysis.decision.type === "no_recomendado_sin_validacion" && "NO RECOMENDADO SIN VALIDACIÓN"}
                    </h2>
                  </div>
                </div>

                <p className="px-hero-decision__explanation">
                  {analysis.decision.recommendation}
                </p>

                {analysis.decision.conditions && analysis.decision.conditions.length > 0 && (
                  <div className="px-hero-decision__conditions">
                    <h4 className="px-hero-decision__conditions-title">Condiciones para aprobar:</h4>
                    <ul className="px-hero-decision__conditions-list">
                      {analysis.decision.conditions.map((cond: string, idx: number) => (
                        <li key={idx} className="px-hero-decision__condition-item">
                          <span className="px-hero-decision__condition-bullet">•</span>
                          <span>{cond}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.decision.minimum_value_required && analysis.decision.minimum_value_required !== "no especificado" && (
                  <div className="px-hero-decision__min-val">
                    <span className="px-hero-decision__min-val-label">Valor mínimo de viabilidad comercial:</span>
                    <span className="px-hero-decision__min-val-value">{analysis.decision.minimum_value_required}</span>
                  </div>
                )}
              </div>

              {/* 📊 2. KPI STRIP (SECOND ROW) */}
              <div className="px-kpi-strip px-anim-enter px-anim-enter--1">
                {/* Rentabilidad */}
                <div className="px-kpi-card">
                  <span className="px-kpi-card__title">Rentabilidad</span>
                  <span className={`px-kpi-card__value px-kpi-card__value--${
                    analysis.analysis.profitability.val === "alta" ? "green" : analysis.analysis.profitability.val === "media" ? "yellow" : "red"
                  }`}>
                    {analysis.analysis.profitability.val.toUpperCase()}
                  </span>
                  <p className="px-kpi-card__reason">
                    <strong>¿Por qué?:</strong> {analysis.analysis.profitability.reason}
                  </p>
                </div>

                {/* Riesgo */}
                <div className="px-kpi-card">
                  <span className="px-kpi-card__title">Riesgo Contractual</span>
                  <span className={`px-kpi-card__value px-kpi-card__value--${
                    analysis.analysis.risk.val === "bajo" ? "green" : analysis.analysis.risk.val === "medio" ? "yellow" : "red"
                  }`}>
                    {analysis.analysis.risk.val.toUpperCase()}
                  </span>
                  <p className="px-kpi-card__reason">
                    <strong>¿Por qué?:</strong> {analysis.analysis.risk.reason}
                  </p>
                </div>

                {/* Flujo de caja */}
                <div className="px-kpi-card">
                  <span className="px-kpi-card__title">Flujo de Caja</span>
                  <span className={`px-kpi-card__value px-kpi-card__value--${
                    analysis.analysis.cash_flow.val === "fuerte" ? "green" : analysis.analysis.cash_flow.val === "medio" ? "yellow" : "red"
                  }`}>
                    {analysis.analysis.cash_flow.val === "fuerte" ? "FUERTE" : analysis.analysis.cash_flow.val === "medio" ? "MEDIO" : "DÉBIL"}
                  </span>
                  <p className="px-kpi-card__reason">
                    <strong>¿Por qué?:</strong> {analysis.analysis.cash_flow.reason}
                  </p>
                </div>
              </div>

              {/* Fila Dividida: ⚡ 3. ALERTAS COMPACTAS y 💰 4. FACTURACIÓN */}
              <div className="px-split-row px-anim-enter px-anim-enter--2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--px-space-6)" }}>
                {/* 💰 4. FACTURACIÓN */}
                <div className="px-billing-card">
                  <h3 className="px-card-heading">Condiciones de Facturación</h3>
                  <div className="px-billing-grid">
                    <div className="px-billing-field">
                      <span className="px-billing-field-label">📅 Días de Pago</span>
                      <span className="px-billing-field-value">{analysis.billing_conditions.payment_days}</span>
                    </div>
                    <div className="px-billing-field">
                      <span className="px-billing-field-label">📋 Plazos y Requisitos</span>
                      <span className="px-billing-field-value">{analysis.billing_conditions.requirements}</span>
                    </div>
                    <div className="px-billing-field">
                      <span className="px-billing-field-label">🚫 Restricciones</span>
                      <span className="px-billing-field-value">{analysis.billing_conditions.constraints}</span>
                    </div>
                  </div>
                  <div className="px-billing-impact">
                    <span className="px-billing-impact-icon">📈</span>
                    <p className="px-billing-impact-text">
                      <strong>Impacto en flujo:</strong> {analysis.billing_conditions.cash_flow_impact}
                    </p>
                  </div>
                </div>

                {/* ⚡ 3. ALERTAS COMPACTAS */}
                <div className="px-alerts-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--px-space-1)" }}>
                    <h3 className="px-card-heading" style={{ margin: 0 }}>Alertas de Riesgo</h3>
                    {analysis.issues.length > 3 && (
                      <span className="px-badge px-badge--danger" style={{ fontSize: "var(--px-text-xs)" }}>
                        +{analysis.issues.length - 3} más
                      </span>
                    )}
                  </div>
                  <div className="px-alerts-compact-list">
                    {analysis.issues.slice(0, 3).map((issue: string, idx: number) => (
                      <div key={idx} className="px-alerts-compact-item">
                        <span className="px-alerts-compact-icon">⚠️</span>
                        <span className="px-alerts-compact-text">{issue}</span>
                      </div>
                    ))}
                    {analysis.issues.length === 0 && (
                      <p className="px-alerts-compact-empty">
                        ✅ No se han detectado riesgos ni alertas de gravedad en el acuerdo.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 🧠 5. FACTORES PARA FIRMAR (LISTA DE VERIFICACIÓN) */}
              <div className="px-factors-card px-anim-enter px-anim-enter--3">
                <h3 className="px-card-heading" style={{ marginBottom: "var(--px-space-4)" }}>Factores Clave para Firmar</h3>
                <div className="px-factors-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--px-space-4)" }}>
                  
                  <div className="px-factor-item">
                    <span className="px-factor-check">✓</span>
                    <div className="px-factor-info">
                      <span className="px-factor-label">Valor Mínimo</span>
                      <span className="px-factor-value">{analysis.factors_to_sign.minimum_value_required}</span>
                    </div>
                  </div>

                  <div className="px-factor-item">
                    <span className="px-factor-check">✓</span>
                    <div className="px-factor-info">
                      <span className="px-factor-label">Condiciones de Pago</span>
                      <span className="px-factor-value">{analysis.factors_to_sign.payment_conditions}</span>
                    </div>
                  </div>

                  <div className="px-factor-item">
                    <span className="px-factor-check">✓</span>
                    <div className="px-factor-info">
                      <span className="px-factor-label">Riesgo Controlado</span>
                      <span className="px-factor-value">{analysis.factors_to_sign.risk_tolerance}</span>
                    </div>
                  </div>

                  <div className="px-factor-item">
                    <span className="px-factor-check">✓</span>
                    <div className="px-factor-info">
                      <span className="px-factor-label">Costos Cubiertos</span>
                      <span className="px-factor-value">{analysis.factors_to_sign.cost_coverage}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* 🛡️ MOTOR DE DECISIÓN DE PÓLIZAS (POLICIES DECISION ENGINE) */}
              <div className="px-policies-card px-anim-enter px-anim-enter--4">
                <h3 className="px-card-heading" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "var(--px-space-4)" }}>
                  <span>🛡️ Motor de Decisión de Pólizas y Garantías</span>
                </h3>

                {(() => {
                  const requiredPolicies = analysis.policies_analysis.policies_list.filter(p => p.is_explicitly_required_by_contract);
                  const suggestedPolicies = analysis.policies_analysis.policies_list.filter(p => !p.is_explicitly_required_by_contract && p.applies);
                  
                  return (
                    <>
                      {/* 🛡️ 1. REQUIRED POLICY (CRITICAL) */}
                      <div className="px-policies-required-section">
                        <h4 className="px-policies-subsection-title">
                          PÓLIZA EXIGIDA POR EL CONTRATO
                        </h4>
                        
                        {/* Grid de Semáforo de Auditoría */}
                        <div className="px-policies-audit-grid">
                          <div className={`px-audit-kpi ${analysis.policies_analysis.are_policies_required_by_contract ? "px-audit-kpi--active" : "px-audit-kpi--inactive"}`}>
                            <span className="px-audit-kpi-label">¿Exige pólizas el contrato?</span>
                            <span className={`px-badge px-badge--${analysis.policies_analysis.are_policies_required_by_contract ? "danger" : "muted"}`}>
                              {analysis.policies_analysis.are_policies_required_by_contract ? "SÍ" : "NO"}
                            </span>
                          </div>

                          <div className={`px-audit-kpi ${analysis.policies_analysis.is_policy_type_defined ? "px-audit-kpi--active" : "px-audit-kpi--warning"}`}>
                            <span className="px-audit-kpi-label">¿Tipo de póliza especificado?</span>
                            <span className={`px-badge px-badge--${analysis.policies_analysis.is_policy_type_defined ? "success" : "warning"}`}>
                              {analysis.policies_analysis.is_policy_type_defined ? "SÍ" : "NO"}
                            </span>
                          </div>

                          <div className={`px-audit-kpi ${analysis.policies_analysis.is_policy_amount_defined ? "px-audit-kpi--active" : "px-audit-kpi--warning"}`}>
                            <span className="px-audit-kpi-label">¿Monto de cobertura definido?</span>
                            <span className={`px-badge px-badge--${analysis.policies_analysis.is_policy_amount_defined ? "success" : "warning"}`}>
                              {analysis.policies_analysis.is_policy_amount_defined ? "SÍ" : "NO"}
                            </span>
                          </div>
                        </div>

                        {/* Detalle o Advertencia Crítica */}
                        {analysis.policies_analysis.are_policies_required_by_contract ? (
                          <>
                            {(!analysis.policies_analysis.is_policy_type_defined || !analysis.policies_analysis.is_policy_amount_defined || requiredPolicies.length === 0) ? (
                              <div className="px-policies-warning-callout" style={{ marginBottom: "var(--px-space-4)" }}>
                                <span className="px-callout-icon">⚠️</span>
                                <div className="px-callout-content">
                                  <strong>Advertencia de Vacío Contractual:</strong>
                                  <p className="px-callout-text">
                                    El contrato exige pólizas, pero no define el tipo ni el monto. Debe validarse con la orden de compra o el cliente.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="px-policies-success-callout px-policies-success-callout--info" style={{ marginBottom: "var(--px-space-4)" }}>
                                <span className="px-callout-icon">📋</span>
                                <div className="px-callout-content">
                                  <strong>Cláusula de Seguros Identificada:</strong>
                                  <p className="px-callout-text">{analysis.policies_analysis.required_policies_text}</p>
                                </div>
                              </div>
                            )}

                            {requiredPolicies.length > 0 && (
                              <div className="px-policies-table-wrapper px-policies-table-wrapper--required" style={{ marginTop: "var(--px-space-3)" }}>
                                <table className="px-policies-table px-policies-table--required">
                                  <thead>
                                    <tr>
                                      <th>Póliza Exigida / Garantía</th>
                                      <th style={{ width: "130px", textAlign: "center" }}>Origen / Estado</th>
                                      <th>Monto / Cobertura Exigido</th>
                                      <th>Aplicabilidad (Cuándo sí / Cuándo no)</th>
                                      <th>Auditoría / Diagnóstico</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {requiredPolicies.map((policy, idx) => (
                                      <tr key={idx} className="px-policy-row--required">
                                        <td>
                                          <div className="px-policy-name-cell">
                                            <span className="px-policy-icon">🛡️</span>
                                            <div>
                                              <strong className="px-policy-row-title">{policy.name}</strong>
                                            </div>
                                          </div>
                                        </td>
                                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                          <span className="px-badge px-badge--danger px-badge--bold" style={{ fontSize: "10px", padding: "2px 6px" }}>
                                            EXIGIDA POR CONTRATO
                                          </span>
                                        </td>
                                        <td>
                                          <div className="px-policy-cost-cell">
                                            <span className="px-policy-cost-val">{policy.value_details}</span>
                                          </div>
                                        </td>
                                        <td>
                                          <div className="px-policy-applicability-cell">
                                            <div className="px-applies-yes">
                                              <span className="px-indicator">✅</span> <span>{policy.applies_when}</span>
                                            </div>
                                            <div className="px-applies-no" style={{ marginTop: "4px" }}>
                                              <span className="px-indicator">❌</span> <span>{policy.does_not_apply_when}</span>
                                            </div>
                                          </div>
                                        </td>
                                        <td>
                                          <span className="px-policy-diagnosis-text">{policy.why_applies}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="px-policies-success-callout">
                            <span className="px-callout-icon">✓</span>
                            <div className="px-callout-content">
                              <strong>Exención de Pólizas:</strong>
                              <p className="px-callout-text">El contrato no exige de forma explícita la constitución de pólizas de seguros.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <hr style={{ border: 0, borderTop: "1px solid var(--px-border)", margin: "var(--px-space-6) 0" }} />

                      {/* 🟡 2. SUGGESTED POLICIES (SECONDARY) */}
                      <div className="px-policies-suggested-section">
                        <div style={{ marginBottom: "var(--px-space-4)" }}>
                          <h4 className="px-policies-subsection-title" style={{ margin: 0 }}>
                            PÓLIZAS SUGERIDAS (ANÁLISIS)
                          </h4>
                          <p style={{ margin: "4px 0 0", fontSize: "var(--px-text-xs)", color: "var(--px-muted)", fontStyle: "italic" }}>
                            Estimación basada en buenas prácticas, no obligatorias según el contrato.
                          </p>
                        </div>

                        {/* Tabla de Pólizas Sugeridas */}
                        <div className="px-policies-table-wrapper px-policies-table-wrapper--suggested" style={{ marginTop: "0px" }}>
                          <table className="px-policies-table px-policies-table--suggested">
                            <thead>
                              <tr>
                                <th>Póliza Sugerida / Garantía</th>
                                <th style={{ width: "130px", textAlign: "center" }}>Origen / Estado</th>
                                <th>Costo de Prima (Estimación)</th>
                                <th>Aplicabilidad (Cuándo sí / Cuándo no)</th>
                                <th>Auditoría / Diagnóstico</th>
                              </tr>
                            </thead>
                            <tbody>
                              {suggestedPolicies.length > 0 ? (
                                suggestedPolicies.map((policy, idx) => (
                                  <tr key={idx} className="px-policy-row--suggested">
                                    <td>
                                      <div className="px-policy-name-cell">
                                        <span className="px-policy-icon">🛡️</span>
                                        <div>
                                          <strong className="px-policy-row-title">{policy.name}</strong>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                                      <span className="px-badge px-badge--info px-badge--light" style={{ fontSize: "10px", padding: "2px 6px", opacity: 0.8 }}>
                                        SUGERIDA POR ANÁLISIS
                                      </span>
                                    </td>
                                    <td>
                                      <div className="px-policy-cost-cell">
                                        <span className="px-policy-cost-val">{policy.estimated_cost}</span>
                                        <span className="px-policy-cost-desc">{policy.value_details}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="px-policy-applicability-cell">
                                        <div className="px-applies-yes">
                                          <span className="px-indicator">✅</span> <span>{policy.applies_when}</span>
                                        </div>
                                        <div className="px-applies-no" style={{ marginTop: "4px" }}>
                                          <span className="px-indicator">❌</span> <span>{policy.does_not_apply_when}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="px-policy-diagnosis-text">{policy.why_applies}</span>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} style={{ textAlign: "center", color: "var(--px-muted)", fontStyle: "italic", padding: "var(--px-space-4)" }}>
                                    No se identificaron pólizas sugeridas por análisis adicionales.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 🔴 POLICY CONCLUSION (CRITICAL) */}
                      <div className="px-policies-conclusion-section px-anim-enter" style={{ marginTop: "var(--px-space-5)", background: "var(--px-surface-soft)", border: "1px solid var(--px-border)", borderRadius: "var(--px-radius-lg)", padding: "var(--px-space-4)" }}>
                        <h4 className="px-policies-subsection-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px", color: "var(--px-red-bright)" }}>
                          <span>🔴 CONCLUSIÓN DE PÓLIZAS (CRÍTICO)</span>
                        </h4>
                        <p style={{ margin: "var(--px-space-2) 0", fontSize: "var(--px-text-sm)", color: "var(--px-text-soft)", fontWeight: "500" }}>
                          👉 {analysis.policies_analysis.policy_conclusion?.summary || "Con base en las condiciones del contrato, en la práctica se estima que el cliente exigirá:"}
                        </p>

                        <div className="px-policies-conclusion-list" style={{ display: "flex", flexDirection: "column", gap: "var(--px-space-2.5)", margin: "var(--px-space-3) 0" }}>
                          {analysis.policies_analysis.policy_conclusion?.most_likely_required?.length > 0 && (
                            <div className="px-conclusion-item" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--px-text-xs)" }}>
                              <span style={{ background: "rgba(232, 64, 64, 0.1)", color: "var(--px-red)", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", minWidth: "150px", textAlign: "center" }}>1. ALTA PROBABILIDAD</span>
                              <div style={{ color: "var(--px-text-strong)", fontWeight: "600" }}>
                                {analysis.policies_analysis.policy_conclusion.most_likely_required.join(", ")}
                              </div>
                            </div>
                          )}

                          {analysis.policies_analysis.policy_conclusion?.likely_required?.length > 0 && (
                            <div className="px-conclusion-item" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--px-text-xs)" }}>
                              <span style={{ background: "rgba(21, 101, 192, 0.1)", color: "var(--px-blue-bright)", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", minWidth: "150px", textAlign: "center" }}>2. PROBABLE</span>
                              <div style={{ color: "var(--px-text-strong)", fontWeight: "600" }}>
                                {analysis.policies_analysis.policy_conclusion.likely_required.join(", ")}
                              </div>
                            </div>
                          )}

                          {analysis.policies_analysis.policy_conclusion?.optional?.length > 0 && (
                            <div className="px-conclusion-item" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--px-text-xs)" }}>
                              <span style={{ background: "var(--px-gray-100)", color: "var(--px-muted)", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", minWidth: "150px", textAlign: "center" }}>3. OPCIONAL</span>
                              <div style={{ color: "var(--px-text-normal)" }}>
                                {analysis.policies_analysis.policy_conclusion.optional.join(", ")}
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ borderTop: "1px dashed var(--px-border)", paddingTop: "var(--px-space-3)", marginTop: "var(--px-space-3)", display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--px-text-xs)", color: "var(--px-red)", fontWeight: "bold" }}>
                          <span>⚠️ Nota importante:</span>
                          <span style={{ fontStyle: "italic", color: "var(--px-text-strong)" }}>
                            "{analysis.policies_analysis.policy_conclusion?.final_note || "Debe confirmarse con cliente antes de firma"}"
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Grid de Impacto en Negocio */}
                <div className="px-policies-impact-grid" style={{ marginTop: "var(--px-space-2)" }}>
                  <div className="px-policy-impact-item">
                    <div className="px-policy-impact-header">
                      <span className="px-policy-impact-icon">💰</span>
                      <span className="px-policy-impact-title">Impacto en Costos</span>
                    </div>
                    <p className="px-policy-impact-text">{analysis.policies_analysis.business_impact.cost_impact}</p>
                  </div>
                  <div className="px-policy-impact-item">
                    <div className="px-policy-impact-header">
                      <span className="px-policy-impact-icon">📉</span>
                      <span className="px-policy-impact-title">Impacto en Rentabilidad</span>
                    </div>
                    <p className="px-policy-impact-text">{analysis.policies_analysis.business_impact.profitability_impact}</p>
                  </div>
                  <div className="px-policy-impact-item">
                    <div className="px-policy-impact-header">
                      <span className="px-policy-impact-icon">⚡</span>
                      <span className="px-policy-impact-title">Esfuerzo de Gestión</span>
                    </div>
                    <p className="px-policy-impact-text">{analysis.policies_analysis.business_impact.management_effort}</p>
                  </div>
                </div>
              </div>

              {/* 🔬 6. CLAUSE ANALYSIS (COLLAPSIBLE ACORDEÓN) */}
              <div className="px-clauses-accordion-card px-anim-enter px-anim-enter--4">
                <div className="px-clauses-accordion-card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--px-space-4)", gap: "var(--px-space-4)", flexWrap: "wrap" }}>
                  <div>
                    <h3 className="px-card-heading" style={{ margin: 0 }}>Análisis de Cláusulas Específicas</h3>
                    <p style={{ margin: "2px 0 0", fontSize: "var(--px-text-xs)", color: "var(--px-muted)" }}>
                      Haz clic en cualquier cláusula para desglosar su impacto operativo, financiero y de riesgo
                    </p>
                  </div>
                  
                  <div style={{ display: "flex", gap: "var(--px-space-3)", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button className="px-btn px-btn--ghost px-btn--sm" style={{ padding: "var(--px-space-1) var(--px-space-2)", fontSize: "0.75rem", minHeight: "auto" }} onClick={() => expandAllClauses(analysis.clause_impacts?.length || 0)}>
                        Expandir Todo
                      </button>
                      <button className="px-btn px-btn--ghost px-btn--sm" style={{ padding: "var(--px-space-1) var(--px-space-2)", fontSize: "0.75rem", minHeight: "auto" }} onClick={collapseAllClauses}>
                        Colapsar Todo
                      </button>
                    </div>
                    {analysis.clause_impacts && analysis.clause_impacts.length > 0 && (
                      <div style={{ display: "flex", gap: "var(--px-space-1)" }}>
                        <span className="px-badge px-badge--danger" style={{ padding: "2px 6px", fontSize: "10px" }}>
                          {analysis.clause_impacts.filter((c: ClauseImpact) => c.severity === "alta").length} Alta
                        </span>
                        <span className="px-badge px-badge--warning" style={{ padding: "2px 6px", fontSize: "10px" }}>
                          {analysis.clause_impacts.filter((c: ClauseImpact) => c.severity === "media").length} Media
                        </span>
                        <span className="px-badge px-badge--success" style={{ padding: "2px 6px", fontSize: "10px" }}>
                          {analysis.clause_impacts.filter((c: ClauseImpact) => c.severity === "baja").length} Baja
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-clauses-accordion-list" style={{ display: "flex", flexDirection: "column", gap: "var(--px-space-2)" }}>
                  {analysis.clause_impacts && analysis.clause_impacts.length > 0 ? (
                    analysis.clause_impacts.map((ci: ClauseImpact, idx: number) => {
                      const isOpen = !!expandedClauses[idx];
                      return (
                        <div key={idx} className={`px-clause-accordion ${isOpen ? "px-clause-accordion--open" : ""} px-clause-accordion--${ci.severity}`}>
                          <div className="px-clause-accordion__header" onClick={() => toggleClause(idx)}>
                            <div className="px-clause-accordion__title-group">
                              <span className="px-clause-accordion__arrow">▶</span>
                              <span className="px-clause-accordion__number">{String(ci.clause_number || idx + 1).padStart(2, "0")}</span>
                              <span className="px-clause-accordion__name">{ci.clause}</span>
                            </div>
                            <span className={`px-badge px-badge--${ci.severity === "alta" ? "danger" : ci.severity === "media" ? "warning" : "success"}`} style={{ fontSize: "11px" }}>
                              {ci.severity === "alta" ? "🔴 ALTA" : ci.severity === "media" ? "🟡 MEDIA" : "🟢 BAJA"}
                            </span>
                          </div>

                          {isOpen && (
                            <div className="px-clause-accordion__content">
                              <div className="px-clause-accordion__detail">
                                <p style={{ margin: 0 }}>
                                  <strong>Dice el contrato:</strong> {ci.detail}
                                </p>
                              </div>

                              <div className="px-clause-accordion__impact-grid">
                                <div className="px-clause-accordion__impact-col px-clause-accordion__impact-col--financial">
                                  <span className="px-clause-accordion__impact-label">💰 Financiero</span>
                                  <span className="px-clause-accordion__impact-text">{ci.financial_impact}</span>
                                </div>
                                <div className="px-clause-accordion__impact-col px-clause-accordion__impact-col--operational">
                                  <span className="px-clause-accordion__impact-label">⚙️ Operacional</span>
                                  <span className="px-clause-accordion__impact-text">{ci.operational_impact}</span>
                                </div>
                                <div className="px-clause-accordion__impact-col px-clause-accordion__impact-col--risk">
                                  <span className="px-clause-accordion__impact-label">🛡️ Riesgo</span>
                                  <span className="px-clause-accordion__impact-text">{ci.risk_impact}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: "center", padding: "var(--px-space-6)", color: "var(--px-muted)", fontStyle: "italic" }}>
                      No se encontraron cláusulas particulares analizadas.
                    </div>
                  )}
                </div>
              </div>

              {/* DATOS DE METADATOS DEL CONTRATO (BASE VARIABLES) */}
              <div className="px-metadata-card px-anim-enter px-anim-enter--5" style={{ background: "var(--px-surface)", border: "1px solid var(--px-border)", borderRadius: "var(--px-radius-xl)", padding: "var(--px-space-5)", boxShadow: "var(--px-shadow-sm)" }}>
                <h3 className="px-card-heading" style={{ marginBottom: "var(--px-space-3)" }}>Datos Extraídos del Acuerdo</h3>
                
                <div className="px-table-wrap">
                  <table className="px-table">
                    <thead>
                      <tr>
                        <th style={{ width: "230px" }}>Cláusula / Variable</th>
                        <th>Detalle Extraído</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Partes */}
                      <tr>
                        <td><strong>Partes Contratantes</strong></td>
                        <td>
                          {renderParties(analysis.data.parties)}
                        </td>
                      </tr>
                      {/* Valor */}
                      <tr>
                        <td><strong>Valor Proyectado</strong></td>
                        <td className="px-td-money">
                          {analysis.data.value !== "no encontrado" ? (
                            <span>
                              {analysis.data.value} {analysis.data.currency !== "no encontrado" ? analysis.data.currency : ""}
                              {analysis.data.trm !== "no encontrado" ? ` (TRM: ${analysis.data.trm})` : ""}
                            </span>
                          ) : (
                            <span style={{ color: "var(--px-muted)", fontStyle: "italic", fontFamily: "var(--px-font-ui)", fontWeight: "normal" }}>no especificado en contrato</span>
                          )}
                        </td>
                      </tr>
                      {/* Moneda */}
                      <tr>
                        <td><strong>Moneda</strong></td>
                        <td>{analysis.data.currency}</td>
                      </tr>
                      {/* TRM */}
                      <tr>
                        <td><strong>TRM (si aplica)</strong></td>
                        <td>{analysis.data.trm}</td>
                      </tr>
                      {/* Duración */}
                      <tr>
                        <td><strong>Vigencia / Duración</strong></td>
                        <td>{analysis.data.duration}</td>
                      </tr>
                      {/* Forma de pago */}
                      <tr>
                        <td><strong>Condiciones de Radicación</strong></td>
                        <td>{analysis.data.payment_terms}</td>
                      </tr>
                      {/* Pólizas */}
                      <tr>
                        <td><strong>Pólizas y Garantías</strong></td>
                        <td>{analysis.data.policies}</td>
                      </tr>
                      {/* Penalidades */}
                      <tr>
                        <td><strong>Multas y Penalidades</strong></td>
                        <td>{analysis.data.penalties}</td>
                      </tr>
                      {/* Terminación */}
                      <tr>
                        <td><strong>Cláusulas de Terminación</strong></td>
                        <td>{analysis.data.termination}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </section>
      </div>
    </main>
  );
}
