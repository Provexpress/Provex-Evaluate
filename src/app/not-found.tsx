import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", textAlign: "center", fontFamily: "sans-serif", background: "#f8f9fa" }}>
      <h1 style={{ fontSize: "3rem", margin: "0 0 1rem 0", color: "#343a40" }}>404</h1>
      <p style={{ fontSize: "1.2rem", margin: "0 0 2rem 0", color: "#6c757d" }}>Página no encontrada</p>
      <Link href="/" style={{ padding: "0.75rem 1.5rem", background: "#6a3fa0", color: "#ffffff", borderRadius: "8px", textDecoration: "none", fontWeight: "bold" }}>
        Volver al Inicio
      </Link>
    </div>
  );
}
