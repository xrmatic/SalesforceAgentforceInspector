import React from 'react'

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SessionList({ sessions, onSessionSelect }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
        <div className="text-4xl mb-3">👻</div>
        <div className="text-gray-400 text-sm mb-2">No ghost sessions yet</div>
        <div className="text-gray-500 text-xs">
          Agent interactions are automatically saved here across tabs.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="text-xs text-gray-500 px-1 pb-2 font-medium uppercase tracking-wider">
        Saved Sessions ({sessions.length}/5)
      </div>
      <div className="space-y-2">
        {sessions.map((session, idx) => {
          const shortOrg = session.orgUrl
            ? session.orgUrl.replace('https://', '').split('.')[0]
            : 'Unknown Org'
          const shortId = session.id
            ? session.id.substring(0, 8)
            : `session-${idx}`

          return (
            <button
              key={session.id || idx}
              onClick={() => onSessionSelect(session)}
              className="w-full text-left p-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-blue-400 truncate">{shortOrg}</span>
                    <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">
                      {session.stepCount || 0} steps
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{shortId}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-gray-500">{formatDate(session.timestamp)}</div>
                  <div className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                    Load →
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-3 text-xs text-gray-600 text-center">
        Last 5 sessions persisted across browser restarts
      </div>
    </div>
  )
}

export default SessionList
