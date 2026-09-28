import 'highlight.js/styles/github.css'

import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

/**
 * Renders AI (and user) Markdown safely: react-markdown never renders raw HTML, so model output
 * can't inject markup. Paragraphs pick their own direction (Arabic/English); code stays LTR.
 */
export function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          p: ({ children }) => <p dir="auto">{children}</p>,
          li: ({ children }) => <li dir="auto">{children}</li>,
          h1: ({ children }) => <h3 dir="auto">{children}</h3>,
          h2: ({ children }) => <h3 dir="auto">{children}</h3>,
          h3: ({ children }) => <h3 dir="auto">{children}</h3>,
          blockquote: ({ children }) => <blockquote dir="auto">{children}</blockquote>,
          pre: ({ children }) => <pre dir="ltr">{children}</pre>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
