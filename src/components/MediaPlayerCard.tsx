import { useState, useEffect } from 'react'
import { request, sourcesApi, type ApiSource } from '@/lib/api'
import type { OutboundMessage } from '@/hooks/useControllerWs'

interface PlayerState {
  state: 'playing' | 'paused' | 'stopped'
  positionMs: number
  durationMs: number
  currentFileIndex: number
  loopPlaylist: boolean
}

export function MediaPlayerCard({ mp, send }: { mp: ApiSource; send: (msg: OutboundMessage) => void }) {
  const [playerPlaylist, setPlayerPlaylist] = useState<string[]>(mp.playlist || [])
  const [showBrowser, setShowBrowser] = useState(false)
  const [browserPath, setBrowserPath] = useState('data/media')
  const [browserParent, setBrowserParent] = useState<string | null>(null)
  const [browserDirs, setBrowserDirs] = useState<string[]>([])
  const [browserFiles, setBrowserFiles] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [playerState, setPlayerState] = useState<PlayerState>({ state: 'stopped', positionMs: 0, durationMs: 0, currentFileIndex: 0, loopPlaylist: false })
  const [loopOn, setLoopOn] = useState(false)

  const loadBrowser = (p: string) => {
    request<{ dirs: string[]; files: string[]; path: string; parent: string | null }>(`/api/v1/recorder/dirs?path=${encodeURIComponent(p)}&files=1`)
      .then(d => {
        setBrowserPath(d.path || p)
        setBrowserParent(d.parent)
        setBrowserDirs(d.dirs || [])
        setBrowserFiles(d.files || [])
      }).catch(() => {})
  }

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-[#0b0f14] border border-zinc-800 rounded p-2 text-[11px]">
      {/* Header with name + status dot */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${playerState.state === 'playing' ? 'bg-green-500' : playerState.state === 'paused' ? 'bg-amber-500' : 'bg-zinc-500'}`} />
        <span className="font-semibold text-white text-xs truncate">{mp.name}</span>
        {playerState.state === 'playing' && (
          <span className="text-[10px] text-zinc-500 ml-auto">{fmtTime(playerState.positionMs)} / {fmtTime(playerState.durationMs)}</span>
        )}
      </div>

      {/* Transport row: ▶⏸⏹⏭ on left, ↺📁 on right */}
      <div className="flex items-center gap-1 mb-2">
        <div className="flex gap-1">
          <button type="button" className="px-2 py-1 rounded text-[10px] font-semibold text-green-400 border border-green-400 bg-transparent hover:bg-green-950"
            onClick={() => send({ type: 'MEDIAPLAYER_CONTROL', sourceId: mp.id, action: 'play' })}>▶</button>
          <button type="button" className="px-2 py-1 rounded text-[10px] font-semibold text-amber-400 border border-amber-400 bg-transparent hover:bg-amber-950"
            onClick={() => send({ type: 'MEDIAPLAYER_CONTROL', sourceId: mp.id, action: 'pause' })}>⏸</button>
          <button type="button" className="px-2 py-1 rounded text-[10px] font-semibold text-red-400 border border-red-400 bg-transparent hover:bg-red-950"
            onClick={() => send({ type: 'MEDIAPLAYER_CONTROL', sourceId: mp.id, action: 'stop' })}>⏹</button>
          <button type="button" className="px-2 py-1 rounded text-[10px] font-semibold text-blue-400 border border-blue-400 bg-transparent hover:bg-blue-950"
            onClick={() => send({ type: 'MEDIAPLAYER_CONTROL', sourceId: mp.id, action: 'next' })}>⏭</button>
        </div>
        <div className="flex gap-1 ml-auto">
          <button type="button" onClick={() => { setLoopOn(!loopOn); send({ type: 'MEDIAPLAYER_TOGGLE_LOOP', sourceId: mp.id, active: !loopOn }) }}
            className={`px-2 py-1 rounded text-[10px] font-semibold border bg-transparent ${loopOn ? 'text-green-400 border-green-400' : 'text-zinc-500 border-zinc-600 hover:text-green-400'}`}
            title="Loop playlist">↺</button>
          <button type="button" onClick={() => { if (!showBrowser) loadBrowser('data/media'); setShowBrowser(!showBrowser) }}
            className={`px-2 py-1 rounded text-[10px] font-semibold border bg-transparent ${showBrowser ? 'text-orange-400 border-orange-400' : 'text-zinc-400 border-zinc-600'}`}
            title="Browse files">📁</button>
        </div>
      </div>

      {/* File browser */}
      {showBrowser && (
        <div className="border border-zinc-700 rounded mb-2 p-2 max-h-40 overflow-y-auto bg-[#141a21]">
          <div className="flex gap-1 mb-1">
            {browserParent !== null && (
              <button type="button" className="text-[10px] text-zinc-400 hover:text-white" onClick={() => loadBrowser(browserParent || 'data/media')}>⬆ ..</button>
            )}
            <span className="text-[10px] text-zinc-500 truncate flex-1">/{browserPath}</span>
          </div>
          {browserDirs.map((d) => (
            <button key={d} type="button" className="block w-full text-left text-[10px] text-zinc-300 hover:text-orange-400 px-1"
              onClick={() => loadBrowser(browserPath ? `${browserPath}/${d}` : d)}>📁 {d}</button>
          ))}
          {browserFiles.map((f) => {
            const sel = selectedFiles.has(f)
            return (
              <button key={f} type="button" className={`block w-full text-left text-[10px] px-1 ${sel ? 'text-green-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                onClick={() => {
                  const next = new Set(selectedFiles)
                  if (sel) next.delete(f); else next.add(f)
                  setSelectedFiles(next)
                }}>🎬 {f}</button>
            )
          })}
          {selectedFiles.size > 0 && (
            <button type="button" className="mt-2 w-full px-2 py-1 rounded text-[10px] font-semibold bg-green-600 text-white border border-green-600 hover:bg-green-700"
              onClick={() => {
                const newList = Array.from(selectedFiles)
                setPlayerPlaylist(newList)
                setSelectedFiles(new Set())
                setShowBrowser(false)
                sourcesApi.update(mp.id, { playlist: newList } as any).catch(() => {})
              }}>Add {selectedFiles.size} clips to playlist</button>
          )}
        </div>
      )}

      {/* Playlist with progress bar overlay on active clip */}
      {playerPlaylist.length > 0 && (
        <div className="flex flex-col gap-1">
          {playerPlaylist.map((f, i) => {
            const isActive = i === playerState.currentFileIndex
            const pct = isActive && playerState.durationMs > 0
              ? Math.min(100, (playerState.positionMs / playerState.durationMs) * 100)
              : 0
            return (
              <div key={f} className="relative cursor-pointer" onClick={() => send({ type: 'MEDIAPLAYER_GOTO', sourceId: mp.id, index: i })}>
                {/* Progress bar bg + fill */}
                <div className="absolute inset-0 rounded border border-zinc-600 overflow-hidden">
                  {isActive && pct > 0 && (
                    <div className="absolute inset-y-0 left-0 bg-orange-500/30" style={{ width: `${pct}%` }} />
                  )}
                </div>
                {/* Text overlay */}
                <div className={`relative z-10 px-1.5 py-0.5 text-[10px] truncate ${isActive ? 'text-white font-semibold' : 'text-zinc-400'}`}>
                  <span className="text-zinc-600 mr-1">{i + 1}.</span>
                  {f}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
