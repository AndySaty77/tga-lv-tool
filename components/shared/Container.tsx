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
        boxSizing: "border-box",
        width: "100%",
        maxWidth,
        margin: "0 auto",
        paddingInline: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

