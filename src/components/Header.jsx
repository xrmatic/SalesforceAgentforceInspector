import React, { useState } from 'react'
import { maskCredentials } from '../utils/credentialMasker.js'

function Header({ orgUrl, connected, sessionId, onClear, currentEvents }) {
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  const shortSessionId = sessionId
    ? sessionId.toString().substring(0, 8) + '...'
    : null

  const shortOrgUrl = orgUrl
    ? orgUrl.replace('https://', '').split('.')[0]
    : 'Not connected'

  const handleExport = async () => {
    if (!currentEvents || currentEvents.length === 0) {
      setExportMsg('No data to export')
      setTimeout(() => setExportMsg(''), 2000)
      return
    }
    setExporting(true)
    try {
      const jsonStr = JSON.stringify(currentEvents, null, 2)
      const masked = maskCredentials(jsonStr)
      const blob = new Blob([masked], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `agentforce-trace-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportMsg('Exported!')
    } catch (err) {
      setExportMsg('Export failed')
    } finally {
      setExporting(false)
      setTimeout(() => setExportMsg(''), 2000)
    }
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-blue-400 font-bold text-sm flex-shrink-0">⚡ SF Inspector</div>
        <div className="flex items-center gap-1 min-w-0">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              connected ? 'bg-green-400' : 'bg-gray-500'
            }`}
            title={connected ? 'Connected' : 'Not connected'}
          />
          <span className="text-gray-400 text-xs truncate">{shortOrgUrl}</span>
        </div>
        {shortSessionId && (
          <span className="text-gray-600 text-xs font-mono hidden sm:block">
            {shortSessionId}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {exportMsg && (
          <span className="text-xs text-green-400 mr-1">{exportMsg}</span>
        )}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-50"
          title="Export trace (credentials masked)"
        >
          {exporting ? '...' : '↓ Export'}
        </button>
        <button
          onClick={onClear}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-red-900 text-gray-400 hover:text-red-300 rounded transition-colors"
          title="Clear all sessions"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default Header
