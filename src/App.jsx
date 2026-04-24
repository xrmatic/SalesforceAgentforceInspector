import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header.jsx'
import Timeline from './components/Timeline.jsx'
import StepDetail from './components/StepDetail.jsx'
import SessionList from './components/SessionList.jsx'
import LogParser from './components/LogParser.jsx'
import GroundingCheck from './components/GroundingCheck.jsx'

const TABS = [
  { id: 'trace', label: 'Atlas Trace' },
  { id: 'logs', label: 'Log Parser' },
  { id: 'grounding', label: 'Grounding' },
  { id: 'sessions', label: 'Sessions' },
]

function App() {
  const [activeTab, setActiveTab] = useState('trace')
  const [sessions, setSessions] = useState([])
  const [ghostSessions, setGhostSessions] = useState([])
  const [currentEvents, setCurrentEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedStep, setSelectedStep] = useState(null)
  const [connected, setConnected] = useState(false)
  const [orgUrl, setOrgUrl] = useState('')
  const [loading, setLoading] = useState(true)

  const loadSessions = useCallback(async () => {
    if (!chrome?.runtime?.sendMessage) return
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SESSIONS' })
      if (response?.success) {
        setCurrentEvents(response.currentEvents || [])
        setGhostSessions(response.ghostSessions || [])
        if ((response.currentEvents || []).length > 0) {
          setConnected(true)
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()

    // Get current tab info
    if (chrome?.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          try {
            const url = new URL(tabs[0].url)
            const { hostname } = url
            const isSalesforce = hostname === 'salesforce.com' || hostname.endsWith('.salesforce.com') ||
                                  hostname === 'force.com' || hostname.endsWith('.force.com')
            if (isSalesforce) {
              setOrgUrl(url.origin)
              setConnected(true)
            }
          } catch {
            // ignore invalid URLs
          }
        }
      })
    }

    // Listen for real-time updates from background
    const messageListener = (message) => {
      if (message.type === 'SESSIONS_UPDATED') {
        setCurrentEvents(message.data.events || [])
        setConnected(true)
      }
    }

    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener)
      return () => chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [loadSessions])

  const handleSessionSelect = (session) => {
    setSelectedEvent(session)
    setSelectedStep(null)
    setActiveTab('trace')
  }

  const handleClearSessions = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_SESSIONS' })
      setCurrentEvents([])
      setGhostSessions([])
      setSelectedEvent(null)
      setSelectedStep(null)
    } catch (err) {
      console.error('Failed to clear sessions:', err)
    }
  }

  const stepsForTimeline = selectedEvent
    ? (selectedEvent.data?.steps || [selectedEvent.data || selectedEvent])
    : currentEvents.slice(0, 10)

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <Header
        orgUrl={orgUrl}
        connected={connected}
        sessionId={selectedEvent?.id || currentEvents[0]?.id}
        onClear={handleClearSessions}
        currentEvents={currentEvents}
      />

      {/* Tab Bar */}
      <div className="flex border-b border-gray-700 bg-gray-800 flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-400 text-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
            {tab.id === 'trace' && currentEvents.length > 0 && (
              <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1">
                {currentEvents.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-gray-500 text-sm">Loading...</div>
          </div>
        ) : (
          <>
            {activeTab === 'trace' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {stepsForTimeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                    <div className="text-4xl mb-3">🤖</div>
                    <div className="text-gray-400 text-sm mb-2">No agent traces captured yet</div>
                    <div className="text-gray-500 text-xs">
                      Navigate to Salesforce Agent Builder and interact with an agent to see traces here.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 overflow-hidden">
                    <div className="w-1/2 border-r border-gray-700 overflow-y-auto">
                      <Timeline
                        events={stepsForTimeline}
                        selectedStep={selectedStep}
                        onStepSelect={setSelectedStep}
                      />
                    </div>
                    <div className="w-1/2 overflow-y-auto">
                      {selectedStep ? (
                        <StepDetail step={selectedStep} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-gray-500 text-xs text-center p-4">
                            Select a step from the timeline to view details
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <LogParser />
            )}

            {activeTab === 'grounding' && (
              <GroundingCheck
                currentEvents={currentEvents}
                orgUrl={orgUrl}
              />
            )}

            {activeTab === 'sessions' && (
              <SessionList
                sessions={ghostSessions}
                onSessionSelect={handleSessionSelect}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App
