import React, { useState, useRef } from 'react'

const SAMPLE_LOG = `09:15:32.123|AGENT_PLANNING|{"planId":"p001","action":"retrieve_account","reasoning":"User asked for account details"}
09:15:33.456|DATA_GROUNDING|{"recordId":"0015g00000ABC123","objectType":"Account","fieldsRetrieved":["Name","Industry","Revenue"]}
09:15:34.789|AGENT_PLANNING|{"planId":"p002","action":"format_response","reasoning":"Formatting retrieved data for user"}
09:15:35.012|DATA_GROUNDING|{"recordId":"0035g00000XYZ789","objectType":"Contact","fieldsRetrieved":["Name","Email","Phone"]}`

function EventCard({ event, type }) {
  const [expanded, setExpanded] = useState(false)
  const bgClass = type === 'planning'
    ? 'border-blue-700/50 bg-blue-950/30'
    : 'border-green-700/50 bg-green-950/30'
  const labelClass = type === 'planning' ? 'text-blue-400' : 'text-green-400'

  return (
    <div className={`border rounded p-2 mb-2 ${bgClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${labelClass}`}>
              {type === 'planning' ? '🗺️ AGENT_PLANNING' : '🔍 DATA_GROUNDING'}
            </span>
            {event.timestamp && (
              <span className="text-xs text-gray-500 font-mono">{event.timestamp}</span>
            )}
            <span className="text-xs text-gray-600">L{event.lineNumber}</span>
          </div>
          {!expanded && (
            <div className="text-xs text-gray-400 truncate font-mono">
              {typeof event.detail === 'object'
                ? JSON.stringify(event.detail).substring(0, 80) + '...'
                : String(event.detail).substring(0, 80)}
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {expanded && (
        <pre className="mt-2 text-xs text-gray-300 bg-gray-950 rounded p-2 overflow-x-auto font-mono">
          {typeof event.detail === 'object'
            ? JSON.stringify(event.detail, null, 2)
            : event.detail}
        </pre>
      )}
    </div>
  )
}

function LogParser() {
  const [logText, setLogText] = useState('')
  const [result, setResult] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)

  const parseLog = async () => {
    if (!logText.trim()) {
      setError('Please paste an Apex Debug Log')
      return
    }
    setParsing(true)
    setError('')
    setResult(null)

    try {
      if (chrome?.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          type: 'PARSE_LOG',
          data: { log: logText },
        })
        if (response?.success) {
          setResult(response.result)
        } else {
          setError(response?.error || 'Parse failed')
        }
      } else {
        // Fallback: parse locally in sidepanel context
        const lines = logText.split('\n')
        const agentPlanningEvents = []
        const dataGroundingEvents = []

        lines.forEach((line, idx) => {
          const tsMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d+)/)
          const timestamp = tsMatch ? tsMatch[1] : null

          const apMatch = line.match(/AGENT_PLANNING[|\s](.+)/)
          if (apMatch) {
            let detail = apMatch[1]
            try { detail = JSON.parse(detail) } catch (e) {}
            agentPlanningEvents.push({ lineNumber: idx + 1, timestamp, raw: line, detail })
          }

          const dgMatch = line.match(/DATA_GROUNDING[|\s](.+)/)
          if (dgMatch) {
            let detail = dgMatch[1]
            try { detail = JSON.parse(detail) } catch (e) {}
            dataGroundingEvents.push({ lineNumber: idx + 1, timestamp, raw: line, detail })
          }
        })

        setResult({
          agentPlanningEvents,
          dataGroundingEvents,
          summary: {
            totalEvents: agentPlanningEvents.length + dataGroundingEvents.length,
            planningCount: agentPlanningEvents.length,
            groundingCount: dataGroundingEvents.length,
          },
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  const loadSample = () => {
    setLogText(SAMPLE_LOG)
    setResult(null)
    setError('')
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
      {/* Input area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Apex Debug Log
          </span>
          <button
            onClick={loadSample}
            className="text-xs text-blue-500 hover:text-blue-400"
          >
            Load sample
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
          placeholder="Paste your Apex Debug Log here..."
          className="w-full h-32 bg-gray-800 border border-gray-700 rounded p-2 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-blue-500 placeholder-gray-600"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={parseLog}
            disabled={parsing || !logText.trim()}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
          >
            {parsing ? 'Parsing...' : '⚡ Parse Log'}
          </button>
          {logText && (
            <button
              onClick={() => { setLogText(''); setResult(null); setError('') }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs rounded"
            >
              Clear
            </button>
          )}
        </div>
        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded p-2">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="flex-1 overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Total', value: result.summary.totalEvents, color: 'text-white' },
              { label: 'Planning', value: result.summary.planningCount, color: 'text-blue-400' },
              { label: 'Grounding', value: result.summary.groundingCount, color: 'text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-800 rounded p-2 text-center">
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Events */}
          {result.agentPlanningEvents.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-blue-400 mb-2 uppercase tracking-wider">
                Agent Planning Events
              </div>
              {result.agentPlanningEvents.map((e, i) => (
                <EventCard key={i} event={e} type="planning" />
              ))}
            </div>
          )}

          {result.dataGroundingEvents.length > 0 && (
            <div>
              <div className="text-xs font-medium text-green-400 mb-2 uppercase tracking-wider">
                Data Grounding Events
              </div>
              {result.dataGroundingEvents.map((e, i) => (
                <EventCard key={i} event={e} type="grounding" />
              ))}
            </div>
          )}

          {result.summary.totalEvents === 0 && (
            <div className="text-center text-gray-500 text-sm py-6">
              No AGENT_PLANNING or DATA_GROUNDING events found in this log.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LogParser
