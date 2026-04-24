import React from 'react'

const TYPE_STYLES = {
  PLAN: { color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-700', icon: '🗺️' },
  TOOL: { color: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-700', icon: '🔧' },
  THOUGHT: { color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700', icon: '💭' },
  ACTION: { color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700', icon: '▶️' },
  OBSERVATION: { color: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-700', icon: '👁️' },
  DEFAULT: { color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-700', icon: '📋' },
}

function inferStepType(event) {
  const url = (event.url || '').toLowerCase()
  const body = JSON.stringify(event.body || event.data || '').toLowerCase()

  if (url.includes('plan') || body.includes('"plan"') || body.includes('planning')) return 'PLAN'
  if (url.includes('tool') || body.includes('"tool"') || body.includes('toolname')) return 'TOOL'
  if (body.includes('thought') || body.includes('reasoning')) return 'THOUGHT'
  if (body.includes('action') || body.includes('execute')) return 'ACTION'
  if (body.includes('observation') || body.includes('result')) return 'OBSERVATION'
  return 'DEFAULT'
}

function getSummary(event) {
  const body = event.body || event.data || {}
  if (typeof body === 'string') {
    return body.substring(0, 80) + (body.length > 80 ? '...' : '')
  }
  if (body.message) return String(body.message).substring(0, 80)
  if (body.planningResult) return 'Planning: ' + String(body.planningResult).substring(0, 60)
  if (body.toolName) return `Tool: ${body.toolName}`
  if (body.url) return body.url
  const keys = Object.keys(body)
  if (keys.length > 0) return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`
  return event.url || 'Event captured'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function Timeline({ events, selectedStep, onStepSelect }) {
  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-xs text-center">
        No steps captured
      </div>
    )
  }

  return (
    <div className="p-2">
      <div className="text-xs text-gray-500 px-2 pb-2 font-medium uppercase tracking-wider">
        Steps ({events.length})
      </div>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-700" />

        {events.map((event, idx) => {
          const type = inferStepType(event)
          const style = TYPE_STYLES[type] || TYPE_STYLES.DEFAULT
          const isSelected = selectedStep === event
          const summary = getSummary(event)

          return (
            <div
              key={event.id || idx}
              onClick={() => onStepSelect(isSelected ? null : event)}
              className={`relative flex gap-3 p-2 mb-1 rounded cursor-pointer transition-colors ${
                isSelected
                  ? `${style.bg} border ${style.border}`
                  : 'hover:bg-gray-800 border border-transparent'
              }`}
            >
              {/* Step indicator */}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${style.bg} border ${style.border}`}>
                <span>{idx + 1}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold ${style.color}`}>
                    {style.icon} {type}
                  </span>
                  <span className="text-gray-600 text-xs ml-auto">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-gray-400 truncate">{summary}</div>
                {event.status && (
                  <div className={`text-xs mt-0.5 ${event.status >= 400 ? 'text-red-400' : 'text-gray-600'}`}>
                    HTTP {event.status}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Timeline
