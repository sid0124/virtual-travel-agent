"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="ml-5 list-disc space-y-1 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1 text-sm">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h1: ({ children }) => <h1 className="text-base font-semibold">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-semibold mt-2">{children}</h2>,
        a: ({ children, href }) => (
          <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
