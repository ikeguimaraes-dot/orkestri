"use client";

export function SkipLink() {
  return (
    <a
      href="#main-content"
      style={{
        position: "absolute",
        top: -48,
        left: 0,
        background: "#C4622D",
        color: "#fff",
        padding: "10px 18px",
        zIndex: 9999,
        textDecoration: "none",
        fontWeight: 600,
        fontSize: 14,
        borderRadius: "0 0 8px 0",
        transition: "top 0.15s",
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.top = "0";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.top = "-48px";
      }}
    >
      Pular para o conteúdo
    </a>
  );
}
