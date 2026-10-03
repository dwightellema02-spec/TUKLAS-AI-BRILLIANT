import React, { HTMLAttributes } from "react";
import { Container } from "@/components/ui/Container";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  id?: string;
  badge?: string;
  title?: string;
  description?: string;
  centered?: boolean;
}

export function Section({
  id,
  badge,
  title,
  description,
  centered = false,
  className = "",
  children,
  ...props
}: SectionProps) {
  const alignment = centered ? "text-center items-center" : "text-left items-start";

  return (
    <section id={id} className={`py-14 sm:py-20 lg:py-24 ${className}`} {...props}>
      <Container>
        {(badge || title || description) && (
          <div className={`flex flex-col mb-10 sm:mb-14 ${alignment}`}>
            {badge && (
              <span className="inline-block text-xs font-semibold tracking-wider text-teal-700 uppercase bg-teal-50 px-3 py-1 rounded-full border border-teal-200/60 mb-3">
                {badge}
              </span>
            )}
            {title && (
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
