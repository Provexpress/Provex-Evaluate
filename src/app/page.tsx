"use client";

import React, { useState, useEffect, useRef } from "react";
import type { ContractAnalysis, ClauseImpact } from "@/lib/contract-analysis/schema";

const decisionClassMap: Record<string, string> = {
  firmar: "sign",
  firmar_con_condiciones: "conditional",
  no_recomendado_sin_validacion: "do_not_sign"
};


export default function Home() {
  // Estado del archivo de contrato y arrastre
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado del archivo de orden de compra y arrastre
  const [purchaseOrderFile, setPurchaseOrderFile] = useState<File | null>(null);
  const [poDragActive, setPoDragActive] = useState<boolean>(false);
  const poInputRef = useRef<HTMLInputElement>(null);

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

  // Eventos de arrastre para orden de compra
  const handlePoDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setPoDragActive(true);
    } else if (e.type === "dragleave") {
      setPoDragActive(false);
    }
  };

  const handlePoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPoDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf" || droppedFile.name.endsWith(".pdf")) {
        setPurchaseOrderFile(droppedFile);
        setError(null);
      } else {
        setError("Únicamente se soportan archivos PDF para la Orden de Compra.");
      }
    }
  };

  const handlePoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".pdf")) {
        setPurchaseOrderFile(selectedFile);
        setError(null);
      } else {
        setError("Únicamente se soportan archivos PDF para la Orden de Compra.");
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerPoFileSelect = () => {
    poInputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePoFile = () => {
    setPurchaseOrderFile(null);
    if (poInputRef.current) {
      poInputRef.current.value = "";
    }
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
    if (poInputRef.current) {
      poInputRef.current.value = "";
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

  return (
    <main className="px-shell px-shell--dashboard px-stack">
      {/* Barra superior del sistema */}
      <header className="px-topbar">
        <div className="px-brand">
          <div className="px-logo px-logo--sm">PX</div>
          <div className="px-brand__meta">
            <p className="px-eyebrow">Evaluación Contractual</p>
            <h1 className="px-brand__title">ProvexEvaluate</h1>
            <p className="px-brand__subtitle">Panel de Decisión Comercial - Lado Proveedor</p>
          </div>
        </div>
        <div className="px-actions">
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
                  <button className="px-btn px-btn--ghost px-btn--sm px-btn--icon" onClick={removeFile} disabled={isLoading} title="Eliminar contrato">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Orden de Compra */}
            <div className="px-field">
              <label className="px-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display:"inline", marginRight:"5px", verticalAlign:"middle" }}>
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="12" y2="17" />
                </svg>
                Orden de Compra
                <span style={{ fontWeight:"normal", color:"var(--px-muted-2)", textTransform:"none", letterSpacing:0, marginLeft:"4px", fontSize:"0.7rem" }}>— Opcional</span>
              </label>
              {!purchaseOrderFile ? (
                <div
                  className={`px-upload-zone ${poDragActive ? "drag-over" : ""}`}
                  onDragEnter={handlePoDrag}
                  onDragOver={handlePoDrag}
                  onDragLeave={handlePoDrag}
                  onDrop={handlePoDrop}
                  onClick={triggerPoFileSelect}
                  style={{ padding: "var(--px-space-4) var(--px-space-3)", minHeight: "100px" }}
                >
                  <div className="px-upload-icon-circle" style={{ width:"36px", height:"36px", background:"rgba(106,63,160,0.10)", color:"var(--px-purple)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                  </div>
                  <p className="px-upload-title" style={{ fontSize:"var(--px-text-sm)" }}>Subir Orden de Compra</p>
                  <p className="px-upload-subtitle">Si el contrato no incluye valor económico</p>
                  <input ref={poInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handlePoFileChange} />
                </div>
              ) : (
                <div className="px-file-card" style={{ borderStyle:"dashed" }}>
                  <div className="px-file-icon" style={{ backgroundColor:"rgba(106,63,160,0.12)", color:"var(--px-purple)" }}>O/C</div>
                  <div className="px-file-info">
                    <p className="px-file-name" title={purchaseOrderFile.name}>{purchaseOrderFile.name}</p>
                    <p className="px-file-size">{(purchaseOrderFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button className="px-btn px-btn--ghost px-btn--sm px-btn--icon" onClick={removePoFile} disabled={isLoading} title="Eliminar orden de compra">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
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

              {/* 🛡️ INSURANCE & GUARANTEES ANALYSIS (PÓLIZAS) */}
              <div className="px-policies-card px-anim-enter px-anim-enter--4">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--px-space-4)", gap: "var(--px-space-4)", flexWrap: "wrap" }}>
                  <div>
                    <h3 className="px-card-heading" style={{ margin: 0 }}>🛡️ Motor de Decisión de Pólizas y Garantías</h3>
                    <p style={{ margin: "2px 0 0", fontSize: "var(--px-text-xs)", color: "var(--px-muted)" }}>
                      Evaluación analítica de seguros y garantías sugeridas frente a las condiciones del contrato
                    </p>
                  </div>
                  <span className={`px-badge px-badge--${analysis.policies_analysis.does_apply ? "warning" : "success"}`}>
                    {analysis.policies_analysis.required_status.toUpperCase()}
                  </span>
                </div>

                {/* Tabla de Decisiones de Pólizas */}
                <div className="px-policies-table-wrapper">
                  <table className="px-policies-table">
                    <thead>
                      <tr>
                        <th>Póliza / Garantía</th>
                        <th style={{ width: "100px", textAlign: "center" }}>¿Aplica?</th>
                        <th style={{ width: "100px", textAlign: "center" }}>¿Definida?</th>
                        <th>Estimación de Valor</th>
                        <th>Aplicabilidad (Cuándo sí / Cuándo no)</th>
                        <th>Auditoría / Diagnóstico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.policies_analysis.policies_list.map((policy, idx) => (
                        <tr key={idx} className={policy.applies ? "px-policy-row--applies" : "px-policy-row--inactive"}>
                          <td>
                            <div className="px-policy-name-cell">
                              <span className="px-policy-icon">🛡️</span>
                              <div>
                                <strong style={{ color: "var(--px-text-strong)", fontSize: "var(--px-text-sm)" }}>{policy.name}</strong>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                            <span className={`px-badge px-badge--${policy.applies ? "warning" : "muted"}`}>
                              {policy.applies ? "SÍ" : "NO"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                            <span className={`px-badge px-badge--${policy.are_values_specified ? "success" : "danger"}`}>
                              {policy.are_values_specified ? "SÍ" : "NO"}
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
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Grid de Impacto en Negocio */}
                <div className="px-policies-impact-grid">
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
