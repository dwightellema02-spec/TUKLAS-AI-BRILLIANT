import React, { HTMLAttributes } from "react";

export function Container({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
