import { useState } from 'react'
import { request, sourcesApi, type ApiSource } from '@/lib/api'

export function MediaPlayerCard({ mp }: { mp: ApiSource }) {
  const [playerPlaylist, setPlayerPlaylist] = useState<string[]>([])
  const [showBrowser, setShowBrowser] = useState(false)
  const [browserPath, setBrowserPath] = useState('data/media')
  const [browserParent, setBrowserParent] = useState<string | null>(null)
  const [browserDirs, setBrowserDirs] = useState<string[]>([])
  const [browserFiles, setBrowserFiles] = useState<string[]>([])  
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  const loadBrowser = (p: string) => {
    request<{ dirs: string[]; files: string[]; path: string; parent: string | null }>(`/api/v1/recorder/dirs?path=${encodeURIComponent(p)}&files=1`)
      .then(d => {
        setBrowserPath(d.path || p)
        setBrowserParent(d.parent)
        setBrowserDirs(d.dirs || [])
        setBrowserFiles(d.files || [])
      }).catch(() => {})
  }

  return (
    <div className="bg-[#0b0f14] border border-zinc-800 rounded p-2 text-[11px]">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
        <span className="font-semibold text-white text-xs">{mp.name}</span>
      </div>
      <div className="flex gap-1 mb-2">
        {/* Transport buttons don't need send prop — they're placeholder for now */}
        <button type="button" className="px-2 py-1 rounded text-[10px] font-semibold text-green-400 border border-green-400 bg-transparent hover:bg-green-950">▶</button>
        <button type="button" className="px-2 py-1 rounded text-[10px] font-semibold text-amber-400 border border-amber-400 bg-transparent hover:bg-amber-950">⏸</button>
        <button type="button" className="px-2 py-1 rounded text-[10px] font-semibold text-red-400 border border-red-400 bg-transparent hover:bg-red-950">⏹</button>
        <button type="button" className="px-2 py-1 rounded text-[10px] font-semibold text-blue-400 border border-blue-400 bg-transparent hover:bg-blue-950">⏭</button>
        <button type="button" onClick={() => { if (!showBrowser) loadBrowser('data/media'); setShowBrowser(!showBrowser) }}
          className={`px-2 py-1 rounded text-[10px] font-semibold border bg-transparent ${showBrowser ? 'text-orange-400 border-orange-400' : 'text-zinc-400 border-zinc-600'}`}>📁</button>
      </div>
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
      {playerPlaylist.length > 0 && (
        <div className="text-[10px] text-zinc-500 max-h-24 overflow-y-auto pt-1">
          {playerPlaylist.map((f, i) => (
            <div key={f} className="flex items-center gap-1 text-zinc-400">
              <span className="text-zinc-600 w-4">{i+1}.</span>
              <span className="truncate">{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
