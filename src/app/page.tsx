"use client";

import React, { useState, useEffect, useRef } from "react";
import type { ContractAnalysis } from "@/lib/contract-analysis/schema";

const decisionClassMap: Record<string, string> = {
  firmar: "sign",
  firmar_con_condiciones: "conditional",
  no_firmar: "do_not_sign"
};

export default function Home() {
  // Estado del archivo y arrastre
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Eventos de arrastre
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

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Enviar archivo a la API con costos y márgenes
  const handleAnalyze = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    const formData = new FormData();
    formData.append("file", file);
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
          {(analysis || file || estimatedCost || expectedMargin) && (
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
            <p className="px-eyebrow">1. Documento</p>
            <h2 className="px-panel__title" style={{ fontSize: "var(--px-text-md)", margin: "0" }}>Origen del Contrato</h2>
          </div>

          <div className="px-field">
            <label className="px-label">Cargar Archivo PDF</label>
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
                <p className="px-upload-subtitle">Arrastra y suelta o haz clic para buscar</p>
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
                <button className="px-btn px-btn--ghost px-btn--sm px-btn--icon" onClick={removeFile} disabled={isLoading} title="Eliminar archivo">
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
                <div className="px-decision-header">
                  <div className="px-decision-icon">
                    {analysis.decision.type === "firmar" && "✅"}
                    {analysis.decision.type === "firmar_con_condiciones" && "⚠️"}
                    {analysis.decision.type === "no_firmar" && "❌"}
                  </div>
                  <div className="px-decision-text">
                    <p className="px-eyebrow" style={{ color: "inherit", margin: "0", opacity: 0.85 }}>Recomendación de Viabilidad</p>
                    <h3 className="px-decision-title">
                      {analysis.decision.type === "firmar" && "APROBADO PARA FIRMAR"}
                      {analysis.decision.type === "firmar_con_condiciones" && "FIRMAR CON CONDICIONES"}
                      {analysis.decision.type === "no_firmar" && "NO FIRMAR EL ACUERDO"}
                    </h3>
                  </div>
                </div>
                <p className="px-decision-reason">{analysis.decision.recommendation}</p>

                {/* Si requiere condiciones, las mostramos */}
                {analysis.decision.type === "firmar_con_condiciones" && analysis.decision.conditions && analysis.decision.conditions !== "no encontrado" && (
                  <div style={{ marginTop: "var(--px-space-3)", padding: "var(--px-space-3)", borderRadius: "var(--px-radius-md)", background: "rgba(255, 255, 255, 0.4)", border: "1px dashed var(--px-amber)" }}>
                    <strong style={{ fontSize: "var(--px-text-sm)", color: "#92400E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Condiciones requeridas para firma:</strong>
                    <p style={{ margin: "var(--px-space-1) 0 0 0", fontSize: "var(--px-text-md)", color: "#92400E" }}>{analysis.decision.conditions}</p>
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
                {/* Métricas e Indicadores de Negocio */}
                <div className="px-stack" style={{ gap: "var(--px-space-3)" }}>
                  <article className={`px-kpi px-kpi--${analysis.analysis.profitability === "alta" ? "green" : analysis.analysis.profitability === "media" ? "amber" : "blue"}`}>
                    <p className="px-kpi__label">Rentabilidad</p>
                    <p className="px-kpi__value">{analysis.analysis.profitability.toUpperCase()}</p>
                    <p className="px-kpi__sub">Calificación del margen comercial esperado</p>
                  </article>

                  <article className={`px-kpi px-kpi--${analysis.analysis.risk === "bajo" ? "green" : analysis.analysis.risk === "medio" ? "amber" : "blue"} ${analysis.analysis.risk === "alto" ? "px-kpi--red" : ""}`}>
                    <p className="px-kpi__label">Riesgo Contractual</p>
                    <p className="px-kpi__value">{analysis.analysis.risk.toUpperCase()}</p>
                    <p className="px-kpi__sub">Evaluación de contingencia legal</p>
                  </article>

                  <article className={`px-kpi px-kpi--${analysis.analysis.cash_flow === "fuerte" ? "green" : analysis.analysis.cash_flow === "medio" ? "amber" : "blue"}`}>
                    <p className="px-kpi__label">Flujo de Caja</p>
                    <p className="px-kpi__value">{analysis.analysis.cash_flow.toUpperCase()}</p>
                    <p className="px-kpi__sub">Evaluación del timing de liquidación</p>
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
