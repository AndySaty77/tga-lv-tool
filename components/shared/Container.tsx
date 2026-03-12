import React from "react";

export function Container({
  children,
  maxWidth = 1120,
  style,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth,
        margin: "0 auto",
        padding: "0 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

