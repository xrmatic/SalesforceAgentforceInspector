import React, { useState } from 'react'

function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2)
  }
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number'
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string'
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean'
        } else if (/null/.test(match)) {
          cls = 'json-null'
        }
        return `<span class="${cls}">${match}</span>`
      }
    )
}

function StepDetail({ step }) {
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState('pretty')

  if (!step) return null

  const payload = step.body || step.data || step
  const jsonStr = JSON.stringify(payload, null, 2)
  const highlighted = syntaxHighlight(jsonStr)

  const toolName = payload?.toolName || payload?.tool_name || payload?.name
  const planningResult = payload?.planningResult || payload?.plan
  const method = step.method || 'GET'
  const url = step.url || ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonStr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  return (
    <div className="p-3 flex flex-col h-full">
      {/* Header info */}
      <div className="mb-3 space-y-1.5">
        {url && (
          <div className="flex items-start gap-1.5">
            <span className={`text-xs font-mono px-1 rounded flex-shrink-0 ${
              method === 'GET' ? 'bg-blue-900 text-blue-300' :
              method === 'POST' ? 'bg-green-900 text-green-300' :
              'bg-gray-700 text-gray-300'
            }`}>{method}</span>
            <span className="text-xs text-gray-400 font-mono break-all">{url}</span>
          </div>
        )}
        {toolName && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Tool:</span>
            <span className="text-xs text-purple-400 font-mono">{toolName}</span>
          </div>
        )}
        {planningResult && (
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded p-2">
            <div className="text-xs text-yellow-400 font-medium mb-1">Planning Result</div>
            <div className="text-xs text-gray-300">
              {typeof planningResult === 'string' ? planningResult : JSON.stringify(planningResult)}
            </div>
          </div>
        )}
      </div>

      {/* View toggle + copy */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {['pretty', 'raw'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                view === v ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-400"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* JSON content */}
      <div className="flex-1 overflow-y-auto bg-gray-950 rounded border border-gray-800">
        {view === 'pretty' ? (
          <pre
            className="text-xs p-3 leading-relaxed font-mono"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <pre className="text-xs p-3 leading-relaxed font-mono text-gray-300 whitespace-pre-wrap break-all">
            {jsonStr}
          </pre>
        )}
      </div>
    </div>
  )
}

export default StepDetail
