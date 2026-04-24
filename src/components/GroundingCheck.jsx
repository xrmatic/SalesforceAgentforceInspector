import React, { useState, useEffect } from 'react'

function extractRecordIds(events) {
  const ids = new Set()
  const sfIdPattern = /\b([0-9A-Za-z]{15}|[0-9A-Za-z]{18})\b/g

  for (const event of events) {
    const bodyStr = JSON.stringify(event.body || event.data || '')
    const matches = bodyStr.match(sfIdPattern) || []
    matches.forEach((id) => {
      if (/^[0-9A-Za-z]{15,18}$/.test(id) && !/^[0-9]+$/.test(id)) {
        ids.add(id)
      }
    })
  }

  return [...ids].slice(0, 20) // Cap at 20 for performance
}

const STATUS_STYLES = {
  unknown: { color: 'text-gray-400', bg: 'bg-gray-800', icon: '○', label: 'Unknown' },
  ok: { color: 'text-green-400', bg: 'bg-green-900/20', icon: '✓', label: 'OK' },
  warning: { color: 'text-yellow-400', bg: 'bg-yellow-900/20', icon: '⚠', label: 'Warning' },
  error: { color: 'text-red-400', bg: 'bg-red-900/20', icon: '✗', label: 'Error' },
}

function GroundingCheck({ currentEvents, orgUrl }) {
  const [recordIds, setRecordIds] = useState([])
  const [customId, setCustomId] = useState('')
  const [results, setResults] = useState([])
  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState('')

  useEffect(() => {
    if (currentEvents && currentEvents.length > 0) {
      const ids = extractRecordIds(currentEvents)
      setRecordIds(ids)
    }
  }, [currentEvents])

  const addCustomId = () => {
    const id = customId.trim()
    if (id && !recordIds.includes(id)) {
      setRecordIds((prev) => [...prev, id])
      setCustomId('')
    }
  }

  const removeId = (id) => {
    setRecordIds((prev) => prev.filter((r) => r !== id))
    setResults((prev) => prev.filter((r) => r.recordId !== id))
  }

  const runCheck = async () => {
    if (recordIds.length === 0) {
      setCheckMsg('No record IDs to check')
      setTimeout(() => setCheckMsg(''), 2000)
      return
    }

    setChecking(true)
    setResults([])
    setCheckMsg('')

    try {
      if (chrome?.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          type: 'GROUNDING_CHECK',
          data: { recordIds, orgUrl },
        })
        if (response?.success) {
          setResults(response.results)
        } else {
          setCheckMsg(response?.error || 'Check failed')
        }
      } else {
        // Simulate results
        setResults(
          recordIds.map((id) => ({
            recordId: id,
            status: 'unknown',
            message: 'Grounding check requires extension context.',
            timestamp: Date.now(),
          }))
        )
      }
    } catch (err) {
      setCheckMsg(err.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
      {/* Record ID input */}
      <div>
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Record IDs
        </div>

        {/* Auto-detected IDs */}
        {recordIds.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-2">
            {recordIds.map((id) => (
              <div
                key={id}
                className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5"
              >
                <span className="text-xs text-gray-300 font-mono">{id.substring(0, 8)}...</span>
                <button
                  onClick={() => removeId(id)}
                  className="text-gray-500 hover:text-red-400 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 mb-2">
            No record IDs detected from current traces. Add manually below.
          </div>
        )}

        {/* Manual entry */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomId()}
            placeholder="Add Salesforce record ID..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500 placeholder-gray-600 font-mono"
          />
          <button
            onClick={addCustomId}
            disabled={!customId.trim()}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-xs rounded"
          >
            Add
          </button>
        </div>
      </div>

      {/* Run button */}
      <div>
        <button
          onClick={runCheck}
          disabled={checking || recordIds.length === 0}
          className="w-full py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
        >
          {checking ? 'Checking...' : `🔍 Run Health Check (${recordIds.length} records)`}
        </button>
        {checkMsg && (
          <div className="mt-1 text-xs text-yellow-400 text-center">{checkMsg}</div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Results
          </div>
          <div className="space-y-2">
            {results.map((result) => {
              const style = STATUS_STYLES[result.status] || STATUS_STYLES.unknown
              return (
                <div
                  key={result.recordId}
                  className={`p-2 rounded border border-gray-700 ${style.bg}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm ${style.color}`}>{style.icon}</span>
                    <span className="text-xs font-mono text-gray-300">{result.recordId}</span>
                    <span className={`text-xs ml-auto font-medium ${style.color}`}>
                      {style.label}
                    </span>
                  </div>
                  {result.message && (
                    <div className="text-xs text-gray-500">{result.message}</div>
                  )}
                  {result.data && (
                    <pre className="text-xs text-gray-400 mt-1 overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-950/30 border border-blue-800/30 rounded p-2 text-xs text-gray-500">
        ℹ️ Grounding health checks verify that record IDs retrieved by the agent contain the required data fields. Full verification requires Salesforce API access.
      </div>
    </div>
  )
}

export default GroundingCheck
