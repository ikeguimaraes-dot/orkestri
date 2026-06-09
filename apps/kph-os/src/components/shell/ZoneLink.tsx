"use client";

import type { CSSProperties, ReactNode } from "react";

export function ZoneLink({
  href,
  children,
  style,
}: {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <a
      href={href}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        window.location.href = href;
      }}
    >
      {children}
    </a>
  );
}
