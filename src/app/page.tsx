"use client";

import React, { useState, useEffect, useRef } from "react";
import type { ContractAnalysis } from "@/lib/contract-analysis/schema";

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf" || droppedFile.name.endsWith(".pdf")) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Únicamente se soportan archivos PDF para la evaluación contractual.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".pdf")) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Únicamente se soportan archivos PDF para la evaluación contractual.");
      }
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
        <aside className="px-panel px-stack" style={{ gap: "var(--px-space-4)" }}>
          <div className="px-field">
            <p className="px-eyebrow">1. Documentos</p>
            <h2 className="px-panel__title" style={{ fontSize: "var(--px-text-md)", margin: "0" }}>Origen del Contrato</h2>
          </div>

          {/* Carga del Contrato */}
          <div className="px-field">
            <label className="px-label">Contrato Principal (PDF)</label>
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
                <p className="px-upload-title">Subir Contrato PDF</p>
                <p className="px-upload-subtitle">Arrastra o haz clic aquí</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
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
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Carga de la Orden de Compra (Opcional) */}
          <div className="px-field">
            <label className="px-label">Orden de Compra Adjunta (PDF - Opcional)</label>
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
                <div className="px-upload-icon-circle" style={{ width: "36px", height: "36px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <p className="px-upload-title" style={{ fontSize: "var(--px-text-sm)" }}>Subir Orden de Compra</p>
                <input
                  ref={poInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={handlePoFileChange}
                />
              </div>
            ) : (
              <div className="px-file-card" style={{ borderStyle: "dashed" }}>
                <div className="px-file-icon" style={{ backgroundColor: "rgba(106, 63, 160, 0.1)", color: "var(--px-purple)" }}>O/C</div>
                <div className="px-file-info">
                  <p className="px-file-name" title={purchaseOrderFile.name}>{purchaseOrderFile.name}</p>
                  <p className="px-file-size">{(purchaseOrderFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button className="px-btn px-btn--ghost px-btn--sm px-btn--icon" onClick={removePoFile} disabled={isLoading} title="Eliminar orden de compra">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Parámetros de Viabilidad Financiera */}
          <div className="px-field" style={{ marginTop: "var(--px-space-2)" }}>
            <p className="px-eyebrow">2. Parámetros del Negocio</p>
            <h2 className="px-panel__title" style={{ fontSize: "var(--px-text-md)", margin: "0" }}>Viabilidad Financiera</h2>
          </div>

          <div className="px-field">
            <label className="px-label">Costo Estimado (USD)</label>
            <div className="px-input-prefixed-wrapper">
              <span className="px-input-prefix">$</span>
              <input
                type="text"
                className="px-input"
                placeholder="Ej. 50000"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <p className="px-help">Costo proyectado para ejecutar el proyecto</p>
          </div>

          <div className="px-field">
            <label className="px-label">Margen Objetivo (%)</label>
            <input
              type="text"
              className="px-input"
              placeholder="Ej. 25"
              value={expectedMargin}
              onChange={(e) => setExpectedMargin(e.target.value)}
              disabled={isLoading}
            />
            <p className="px-help">Margen comercial requerido para firma</p>
          </div>

          {file && !analysis && (
            <button
              className="px-btn px-btn--primary px-mt-4"
              onClick={handleAnalyze}
              disabled={isLoading}
              style={{ width: "100%", marginTop: "var(--px-space-4)" }}
            >
              <span>Evaluar Riesgo Comercial</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
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
              <div className="px-loader-spinner"></div>
              <h3 className="px-loader-title">Analizando cláusulas del contrato...</h3>
              <p className="px-loader-subtitle">{loadingStatuses[statusIndex]}</p>
            </div>
          )}

          {/* Estado Inicial / Vacío */}
          {!isLoading && !analysis && (
            <div className="px-panel px-empty-view">
              <div className="px-empty-icon">⚖️</div>
              <h2 className="px-title" style={{ fontSize: "var(--px-text-panel)", marginBottom: "var(--px-space-2)" }}>Centro de Decisiones y Riesgos Comerciales</h2>
              <p className="px-copy" style={{ margin: "0" }}>
                Sube un contrato de servicios en formato PDF. El motor financiero y comercial de IA auditará los plazos de pago, multas, pólizas, indemnizaciones y terminaciones unilaterales para entregar una decisión automática.
              </p>
              
              <div className="px-features-row">
                <div className="px-feature-box">
                  <p className="px-feature-num">01</p>
                  <h4 className="px-feature-title">Validar Liquidez</h4>
                  <p className="px-feature-desc">Evalúa plazos de pago, dependencias de firmas y riesgos en el flujo de caja.</p>
                </div>
                <div className="px-feature-box">
                  <p className="px-feature-num">02</p>
                  <h4 className="px-feature-title">Auditar Alertas</h4>
                  <p className="px-feature-desc">Detecta penalidades excesivas, pólizas requeridas y cláusulas unilaterales.</p>
                </div>
                <div className="px-feature-box">
                  <p className="px-feature-num">03</p>
                  <h4 className="px-feature-title">Veredicto de Viabilidad</h4>
                  <p className="px-feature-desc">Obtén una recomendación clara sobre la viabilidad y conveniencia de firmar el acuerdo.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tablero de Decisiones y Resultados */}
          {!isLoading && analysis && (
            <div className="px-stack" style={{ gap: "var(--px-space-4)" }}>
              
              {/* BLOQUE FINAL — DECISIÓN */}
              <div className={`px-decision-alert px-decision-alert--${decisionClassMap[analysis.decision.type] || "conditional"}`}>
                
                {/* Badge destacando si los datos financieros vinieron de la Orden de Compra */}
                {analysis.data.financials_from_po && (
                  <div style={{ display: "inline-flex", marginBottom: "var(--px-space-2.5)" }}>
                    <span className="px-badge px-badge--success" style={{ textTransform: "none", fontSize: "var(--px-text-xs)" }}>
                      💡 Datos financieros extraídos de la Orden de Compra
                    </span>
                  </div>
                )}

                <div className="px-decision-header">
                  <div className="px-decision-icon">
                    {analysis.decision.type === "firmar" && "✅"}
                    {analysis.decision.type === "firmar_con_condiciones" && "⚠️"}
                    {analysis.decision.type === "no_recomendado_sin_validacion" && "❌"}
                  </div>
                  <div className="px-decision-text">
                    <p className="px-eyebrow" style={{ color: "inherit", margin: "0", opacity: 0.85 }}>Recomendación de Viabilidad</p>
                    <h3 className="px-decision-title">
                      {analysis.decision.type === "firmar" && "APROBADO PARA FIRMAR"}
                      {analysis.decision.type === "firmar_con_condiciones" && "FIRMAR CON CONDICIONES"}
                      {analysis.decision.type === "no_recomendado_sin_validacion" && "NO RECOMENDADO SIN VALIDACIÓN"}
                    </h3>
                  </div>
                </div>
                <p className="px-decision-reason">{analysis.decision.recommendation}</p>

                {/* Condiciones para Aprobar (Lista estructurada de viñetas) */}
                {analysis.decision.conditions && analysis.decision.conditions.length > 0 && (
                  <div style={{ marginTop: "var(--px-space-4)", padding: "var(--px-space-4)", borderRadius: "var(--px-radius-md)", background: "rgba(255, 255, 255, 0.4)", border: "1px dashed var(--px-amber)" }}>
                    <strong style={{ fontSize: "var(--px-text-sm)", color: "#92400E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Condiciones para Aprobar:</strong>
                    <ul style={{ margin: "var(--px-space-2) 0 0 0", paddingLeft: "var(--px-space-4)", fontSize: "var(--px-text-md)", color: "#92400E", display: "flex", flexDirection: "column", gap: "var(--px-space-1)" }}>
                      {analysis.decision.conditions.map((cond: string, idx: number) => (
                        <li key={idx}>{cond}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Si se calculó el valor mínimo requerido, lo mostramos */}
                {analysis.decision.minimum_value_required && analysis.decision.minimum_value_required !== "no especificado" && (
                  <div style={{ marginTop: "var(--px-space-3)", padding: "var(--px-space-3)", borderRadius: "var(--px-radius-md)", background: "rgba(255, 255, 255, 0.4)", border: "1px dashed var(--px-blue)" }}>
                    <strong style={{ fontSize: "var(--px-text-sm)", color: "var(--px-text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Valor mínimo requerido calculado:</strong>
                    <p style={{ margin: "var(--px-space-1) 0 0 0", fontSize: "var(--px-text-base)", fontFamily: "var(--px-font-data)", fontWeight: "bold", color: "var(--px-text-strong)" }}>{analysis.decision.minimum_value_required}</p>
                  </div>
                )}
              </div>

              {/* BLOQUE 2 — ANÁLISIS DE NEGOCIO Y BLOQUE 3 — PROBLEMAS CLAVE */}
              <div className="px-grid px-grid--split" style={{ gridTemplateColumns: "340px 1fr", gap: "var(--px-space-4)" }}>
                {/* Métricas e Indicadores de Negocio con explicación */}
                <div className="px-stack" style={{ gap: "var(--px-space-3)" }}>
                  <article className={`px-kpi px-kpi--${analysis.analysis.profitability.val === "alta" ? "green" : analysis.analysis.profitability.val === "media" ? "amber" : "blue"}`}>
                    <p className="px-kpi__label">Rentabilidad</p>
                    <p className="px-kpi__value">{analysis.analysis.profitability.val.toUpperCase()}</p>
                    <p className="px-kpi__sub" style={{ margin: "var(--px-space-1-5) 0 0 0", fontSize: "var(--px-text-xs)", lineHeight: "1.3" }}>
                      <strong>¿Por qué?:</strong> {analysis.analysis.profitability.reason}
                    </p>
                  </article>

                  <article className={`px-kpi px-kpi--${analysis.analysis.risk.val === "bajo" ? "green" : analysis.analysis.risk.val === "medio" ? "amber" : "blue"} ${analysis.analysis.risk.val === "alto" ? "px-kpi--red" : ""}`}>
                    <p className="px-kpi__label">Riesgo Contractual</p>
                    <p className="px-kpi__value">{analysis.analysis.risk.val.toUpperCase()}</p>
                    <p className="px-kpi__sub" style={{ margin: "var(--px-space-1-5) 0 0 0", fontSize: "var(--px-text-xs)", lineHeight: "1.3" }}>
                      <strong>¿Por qué?:</strong> {analysis.analysis.risk.reason}
                    </p>
                  </article>

                  <article className={`px-kpi px-kpi--${analysis.analysis.cash_flow.val === "fuerte" ? "green" : analysis.analysis.cash_flow.val === "medio" ? "amber" : "blue"}`}>
                    <p className="px-kpi__label">Flujo de Caja</p>
                    <p className="px-kpi__value">{analysis.analysis.cash_flow.val.toUpperCase()}</p>
                    <p className="px-kpi__sub" style={{ margin: "var(--px-space-1-5) 0 0 0", fontSize: "var(--px-text-xs)", lineHeight: "1.3" }}>
                      <strong>¿Por qué?:</strong> {analysis.analysis.cash_flow.reason}
                    </p>
                  </article>
                </div>

                {/* Problemas Clave Identificados */}
                <div className="px-panel px-stack" style={{ gap: "var(--px-space-3)" }}>
                  <div className="px-panel__header" style={{ marginBottom: "0", paddingBottom: "0" }}>
                    <div>
                      <p className="px-eyebrow">Bloque 3 — Alertas</p>
                      <h2 className="px-panel__title" style={{ fontSize: "var(--px-text-panel)" }}>Problemas Clave</h2>
                    </div>
                    <span className="px-badge px-badge--danger">{analysis.issues.length}</span>
                  </div>
                  {analysis.issues.length > 0 ? (
                    <ul className="px-issues-list">
                      {analysis.issues.map((issue: string, idx: number) => (
                        <li key={idx} className="px-issue-item">
                          <span className="px-issue-bullet">⚡</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-help" style={{ fontStyle: "italic", margin: "var(--px-space-2) 0" }}>No se detectaron alertas críticas ni condiciones desfavorables en este acuerdo.</p>
                  )}
                </div>
              </div>

              {/* NUEVA SECCIÓN: FACTORES CLAVE PARA FIRMAR */}
              <div className="px-panel px-stack" style={{ gap: "var(--px-space-4)" }}>
                <div>
                  <p className="px-eyebrow">Evaluación de Negocios</p>
                  <h2 className="px-panel__title" style={{ fontSize: "var(--px-text-panel)" }}>Factores Clave para Firmar</h2>
                </div>

                <div className="px-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--px-space-4)" }}>
                  <div className="px-feature-box" style={{ background: "var(--px-surface-raised)" }}>
                    <p className="px-eyebrow" style={{ fontSize: "var(--px-text-xs)", color: "var(--px-purple)" }}>Valor Mínimo Requerido</p>
                    <p style={{ margin: "var(--px-space-1) 0 0 0", fontSize: "var(--px-text-sm)", color: "var(--px-text-strong)", fontWeight: "bold" }}>
                      {analysis.factors_to_sign.minimum_value_required}
                    </p>
                  </div>
                  <div className="px-feature-box" style={{ background: "var(--px-surface-raised)" }}>
                    <p className="px-eyebrow" style={{ fontSize: "var(--px-text-xs)", color: "var(--px-purple)" }}>Condiciones de Pago</p>
                    <p style={{ margin: "var(--px-space-1) 0 0 0", fontSize: "var(--px-text-sm)", color: "var(--px-text-strong)", fontWeight: "bold" }}>
                      {analysis.factors_to_sign.payment_conditions}
                    </p>
                  </div>
                  <div className="px-feature-box" style={{ background: "var(--px-surface-raised)" }}>
                    <p className="px-eyebrow" style={{ fontSize: "var(--px-text-xs)", color: "var(--px-purple)" }}>Tolerancia al Riesgo</p>
                    <p style={{ margin: "var(--px-space-1) 0 0 0", fontSize: "var(--px-text-sm)", color: "var(--px-text-strong)", fontWeight: "bold" }}>
                      {analysis.factors_to_sign.risk_tolerance}
                    </p>
                  </div>
                  <div className="px-feature-box" style={{ background: "var(--px-surface-raised)" }}>
                    <p className="px-eyebrow" style={{ fontSize: "var(--px-text-xs)", color: "var(--px-purple)" }}>Cobertura de Costos</p>
                    <p style={{ margin: "var(--px-space-1) 0 0 0", fontSize: "var(--px-text-sm)", color: "var(--px-text-strong)", fontWeight: "bold" }}>
                      {analysis.factors_to_sign.cost_coverage}
                    </p>
                  </div>
                  <div className="px-feature-box" style={{ background: "var(--px-surface-raised)" }}>
                    <p className="px-eyebrow" style={{ fontSize: "var(--px-text-xs)", color: "var(--px-purple)" }}>Requisitos Operativos</p>
                    <p style={{ margin: "var(--px-space-1) 0 0 0", fontSize: "var(--px-text-sm)", color: "var(--px-text-strong)", fontWeight: "bold" }}>
                      {analysis.factors_to_sign.operational_requirements}
                    </p>
                  </div>
                </div>
              </div>

              {/* BLOQUE 1 — DATOS DEL CONTRATO */}
              <div className="px-panel">
                <div className="px-panel__header" style={{ marginBottom: "var(--px-space-4)" }}>
                  <div>
                    <p className="px-eyebrow">Bloque 1</p>
                    <h2 className="px-panel__title" style={{ fontSize: "var(--px-text-panel)" }}>Datos del Contrato</h2>
                  </div>
                </div>

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
                        <td><strong>Valor</strong></td>
                        <td className="px-td-money">
                          {analysis.data.value !== "no encontrado" ? (
                            <span>
                              {analysis.data.value} {analysis.data.currency !== "no encontrado" ? analysis.data.currency : ""}
                              {analysis.data.trm !== "no encontrado" ? ` (TRM: ${analysis.data.trm})` : ""}
                            </span>
                          ) : (
                            <span style={{ color: "var(--px-muted)", fontStyle: "italic", fontFamily: "var(--px-font-ui)", fontWeight: "normal" }}>no encontrado</span>
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
                        <td><strong>Duración</strong></td>
                        <td>{analysis.data.duration}</td>
                      </tr>
                      {/* Forma de pago */}
                      <tr>
                        <td><strong>Forma de Pago</strong></td>
                        <td>{analysis.data.payment_terms}</td>
                      </tr>
                      {/* Pólizas */}
                      <tr>
                        <td><strong>Pólizas</strong></td>
                        <td>{analysis.data.policies}</td>
                      </tr>
                      {/* Penalidades */}
                      <tr>
                        <td><strong>Penalidades</strong></td>
                        <td>{analysis.data.penalties}</td>
                      </tr>
                      {/* Terminación */}
                      <tr>
                        <td><strong>Terminación</strong></td>
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
