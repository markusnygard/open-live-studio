import { useState, useEffect } from 'react'
import { useOutputsStore, type OutputType } from '@/store/outputs.store'
import { useProductionsStore } from '@/store/productions.store'
import { useSourcesStore } from '@/store/sources.store'
import { capabilitiesApi, productionsApi } from '@/lib/api'
import { request } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StatusDot } from '@/components/ui/StatusDot'

const MEDIA_ROOT = '/data/media'

// Directory browser for recorder output — starts at /data/media
function DirPicker({ value, onChange, onClose }: { value: string; onChange: (d: string) => void; onClose: () => void }) {
  const [dirs, setDirs] = useState<string[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [parent, setParent] = useState<string | null>(null)
  const [custom, setCustom] = useState(value || '')

  const loadDir = (p: string) => {
    request<{ dirs: string[]; path: string; parent: string | null; root: string }>(`/api/v1/recorder/dirs?path=${encodeURIComponent(p)}`)
      .then(d => {
        setDirs(d.dirs || [])
        setCurrentPath(d.path || p)
        setParent(d.parent)
      }).catch(() => setDirs([]))
  }
  useEffect(() => { loadDir(MEDIA_ROOT) }, [])

  // Convert absolute filesystem path to recorder-compatible relative path
  const toRelPath = (absPath: string) => {
    if (absPath.startsWith(MEDIA_ROOT + '/')) return absPath.slice(MEDIA_ROOT.length + 1)
    if (absPath === MEDIA_ROOT) return ''
    return absPath // custom paths as-is
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-[--color-text-muted]">
        {currentPath || MEDIA_ROOT}
      </div>
      <div className="flex gap-2">
        {parent !== null && currentPath !== MEDIA_ROOT && (
          <button type="button" onClick={() => loadDir(parent || MEDIA_ROOT)}
            className="px-2 py-1 rounded text-xs border border-[--color-border-strong] bg-[--color-surface-2] text-[--color-text-muted] hover:text-white">..</button>
        )}
      </div>
      <div className="flex flex-col gap-1 max-h-60 overflow-y-auto border border-[--color-border-strong] rounded p-2">
        {dirs.length === 0 && <div className="text-xs text-[--color-text-muted] p-2">No subdirectories</div>}
        {dirs.map((d) => {
          const fullPath = currentPath ? `${currentPath}/${d}` : `${MEDIA_ROOT}/${d}`
          const relPath = toRelPath(fullPath)
          const isSelected = relPath === value
          return (
            <div key={d} className="flex items-center gap-2">
              <button type="button" onClick={() => { onChange(relPath); onClose() }}
                className={`flex-1 text-left px-2 py-1 rounded text-xs transition-colors ${isSelected ? 'bg-orange-500 text-white' : 'hover:bg-[--color-surface-2] text-[--color-text-primary]'}`}>
                📁 {d}
              </button>
              <button type="button" onClick={() => loadDir(fullPath)}
                className="px-2 py-1 rounded text-xs border border-[--color-border-strong] bg-[--color-surface-2] text-[--color-text-muted] hover:text-orange-500">→</button>
            </div>
          )
        })}
      </div>
      <div>
        <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Custom path</label>
        <input type="text" value={custom} onChange={(e) => setCustom(e.target.value)}
          placeholder="recordings" className={inputCls} onKeyDown={(e) => { if (e.key === 'Enter') { onChange(custom); onClose() } }} />
        <button type="button" onClick={() => { onChange(custom); onClose() }}
          className="mt-2 px-3 py-1 text-xs rounded border border-[--color-border-strong] bg-[--color-surface-2] text-[--color-text-primary] hover:border-orange-500">Use</button>
      </div>
    </div>
  )
}

// Remove old DirPicker — already replaced above

const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  mpegtssrt: 'MPEG-TS/SRT',
  efpsrt: 'EFP/SRT',
  whep: 'WHEP',
  ndi: 'NDI',
  sdi: 'SDI',
  recorder: 'Recorder',
}

function timeSince(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
}

const inputCls = 'w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30'

export function OutputsPanel() {
  const { outputs, isLoading, lastFetchedAt, addOutput, updateOutput, removeOutput, fetchAll } = useOutputsStore()
  const productions = useProductionsStore((s) => s.productions)
  const fetchProductions = useProductionsStore((s) => s.fetchAll)
  const sources = useSourcesStore((s) => s.sources)

  useEffect(() => {
    void fetchAll()
    void fetchProductions()
    const id = setInterval(() => void fetchAll(), 15000)
    return () => clearInterval(id)
  }, [fetchAll, fetchProductions])

  const [creatableTypes, setCreatableTypes] = useState<OutputType[]>(['mpegtssrt', 'efpsrt'])
  const [sdiDevices, setSdiDevices] = useState(4)

  useEffect(() => {
    capabilitiesApi.get().then((caps) => {
      setCreatableTypes(['mpegtssrt', 'efpsrt', ...(caps.ndi ? ['ndi' as OutputType] : []), ...(caps.sdi ? ['sdi' as OutputType] : [])])
      setSdiDevices(caps.sdiDevices > 0 ? caps.sdiDevices : 4)
    }).catch(() => setCreatableTypes(['mpegtssrt', 'efpsrt', 'ndi', 'sdi']))
  }, [])

  const activeOutputIds = new Set(
    productions
      .filter((p) => p.status === 'active' || p.status === 'activating')
      .flatMap((p) => p.outputAssignments.map((o) => o.outputId)),
  )

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; url: string; outputType: OutputType; outputDir?: string; container?: string; audioSource?: string; videoSource?: string } | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [addUrlError, setAddUrlError] = useState<string | null>(null)
  const [editUrlError, setEditUrlError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<OutputType>('mpegtssrt')
  const [newUrl, setNewUrl] = useState('srt://:43524?mode=listener')
  const [newLatency, setNewLatency] = useState(125)
  const [newProdId, setNewProdId] = useState('')
  const [newOutputDir, setNewOutputDir] = useState('recordings')
  const [newContainer, setNewContainer] = useState('mp4')
  const [newAudioSource, setNewAudioSource] = useState('pgm')
  const [newVideoSource, setNewVideoSource] = useState('pgm')
  const [recorderProdId, setRecorderProdId] = useState('')
  const [sourceProdId, setSourceProdId] = useState('')
  const [sourceList, setSourceList] = useState<Array<{ sourceId: string; mixerInput: string; name: string }>>([])
  const [dirPickerOpen, setDirPickerOpen] = useState(false)

  // Fetch production sources when a production is selected for source dropdown
  useEffect(() => {
    if (!sourceProdId) { setSourceList([]); return }
    productionsApi.get(sourceProdId).then((prod) => {
      const assignments = prod.sources ?? []
      const named = assignments.map((a) => {
        const src = sources.find((s) => s.id === a.sourceId)
        return { ...a, name: src?.name ?? a.mixerInput }
      })
      setSourceList(named)
    }).catch(() => setSourceList([]))
  }, [sourceProdId, sources])

  function resetAdd() {
    setNewName('')
    setNewType('mpegtssrt')
    setNewUrl('srt://:43524?mode=listener')
    setNewLatency(125)
    setNewProdId('')
    setSourceProdId('')
    setNewOutputDir('recordings')
    setNewContainer('mp4')
    setNewAudioSource('pgm')
    setNewVideoSource('pgm')
    setRecorderProdId('')
    setDirPickerOpen(false)
    setAddUrlError(null)
  }

  function isValidSrtUrl(s: string): boolean {
    return /^srt:\/\/[^?#]*:\d+/.test(s.trim())
  }

  function typeNeedsUrl(t: OutputType) {
    return t === 'mpegtssrt' || t === 'efpsrt'
  }

  function typeNeedsDevice(t: OutputType) {
    return t === 'sdi'
  }

  async function handleAdd() {
    if (!newName.trim()) return
    if (typeNeedsUrl(newType)) {
      if (!newUrl.trim()) { setAddUrlError('SRT URI is required'); return }
      if (!isValidSrtUrl(newUrl.trim())) { setAddUrlError('Must be a valid srt:// URI'); return }
      const duplicate = outputs.find((o) => o.url?.trim() === newUrl.trim())
      if (duplicate) { setAddUrlError(`Address already used by "${duplicate.name}"`); return }
    }
    const url = typeNeedsUrl(newType) ? newUrl.trim() : typeNeedsDevice(newType) ? (newUrl.trim() || '0') : undefined
    const body: Record<string, unknown> = { name: newName.trim(), outputType: newType, url, videoSource: newVideoSource, audioSource: newAudioSource }
    if (newType === 'mpegtssrt' || newType === 'efpsrt') {
      body.latency = newLatency
    }
    if (newType === 'recorder') {
      body.outputDir = newOutputDir
      body.container = newContainer
      body.audioSource = newAudioSource
      body.videoSource = newVideoSource
    }
    const created = await addOutput(body as { name: string; outputType: OutputType; url?: string; outputDir?: string; container?: string; audioSource?: string; videoSource?: string })
    // Auto-link to selected production
    if (newProdId && created?.id) {
      productionsApi.assignOutput(newProdId, created.id).catch(() => {})
    }
    resetAdd()
    setAddOpen(false)
  }

  async function handleEdit() {
    if (!editTarget || !editTarget.name.trim()) return
    const isSrt = typeNeedsUrl(editTarget.outputType)
    if (isSrt && editTarget.url.trim()) {
      if (!isValidSrtUrl(editTarget.url.trim())) { setEditUrlError('Must be a valid srt:// URI'); return }
      const duplicate = outputs.find((o) => o.id !== editTarget.id && o.url?.trim() === editTarget.url.trim())
      if (duplicate) { setEditUrlError(`Address already used by "${duplicate.name}"`); return }
    }
    const body: Record<string, string | undefined> = {
      name: editTarget.name.trim(),
      url: (isSrt || editTarget.outputType === 'sdi') ? editTarget.url.trim() || undefined : undefined,
    }
    if (editTarget.outputType === 'recorder') {
      body.outputDir = editTarget.outputDir
      body.container = editTarget.container
      body.audioSource = editTarget.audioSource
      body.videoSource = editTarget.videoSource
    }
    await updateOutput(editTarget.id, body as { name?: string; url?: string })
    setEditUrlError(null)
    setEditTarget(null)
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    try {
      await removeOutput(id)
      setDeleteTargetId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete output')
    }
  }

  const deleteTarget = deleteTargetId ? outputs.find((o) => o.id === deleteTargetId) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[--color-text-muted] font-mono">
            {outputs.length} outputs · refreshed {timeSince(lastFetchedAt)}
          </span>
          {isLoading && <span className="text-xs text-[--color-accent]">Refreshing…</span>}
        </div>
        <Button size="sm" variant="active" onClick={() => setAddOpen(true)}>+ New Output</Button>
      </div>

      <div className="flex flex-col gap-1">
        {outputs.map((o) => {
          const inActiveProd = activeOutputIds.has(o.id)
          return (
            <div
              key={o.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded bg-[--color-surface-3] border transition-colors ${
                inActiveProd
                  ? 'border-[--color-border] hover:border-zinc-600 cursor-not-allowed'
                  : 'border-[--color-border] hover:border-orange-500 cursor-pointer'
              }`}
              onClick={() => !inActiveProd && setEditTarget({ id: o.id, name: o.name, url: o.url ?? '', outputType: o.outputType })}
            >
              <StatusDot color={inActiveProd ? 'red' : 'gray'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[--color-text-primary] truncate">{o.name}</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[--color-surface-raised] text-[--color-text-muted] uppercase">
                    {OUTPUT_TYPE_LABELS[o.outputType]}
                  </span>
                </div>
                {o.url && (
                  <span className="text-xs text-[--color-text-muted] font-mono truncate block">{o.url}</span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); !inActiveProd && setEditTarget({ id: o.id, name: o.name, url: o.url ?? '', outputType: o.outputType }) }}
                disabled={inActiveProd}
                className="text-white hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title={inActiveProd ? 'Cannot edit output in an active production' : 'Edit output'}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTargetId(o.id) }}
                disabled={inActiveProd}
                className="text-white hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title={inActiveProd ? 'Output is in an active production' : 'Delete output'}
              >
                Delete
              </Button>
            </div>
          )
        })}
        {outputs.length === 0 && !isLoading && (
          <p className="text-sm text-[--color-text-muted] py-4 text-center">
            No outputs yet. Add one to send program video to an external destination.
          </p>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <Modal open title="Delete Output" onClose={() => { setDeleteTargetId(null); setDeleteError(null) }} className="max-w-sm">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[--color-text-primary]">
              Delete <span className="font-semibold">{deleteTarget.name}</span>? This cannot be undone.
            </p>
            {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setDeleteTargetId(null); setDeleteError(null) }}>Cancel</Button>
              <Button variant="danger" onClick={() => void handleDelete(deleteTarget.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add modal */}
      <Modal open={addOpen} title="New Output" onClose={() => { resetAdd(); setAddOpen(false) }}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Program SRT"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {creatableTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setNewType(t); if (typeNeedsUrl(t)) setNewUrl('srt://:43524?mode=listener'); else setNewUrl('') }}
                  className={`py-2 rounded text-sm border transition-colors ${
                    newType === t
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-surface-2)] border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-orange-500'
                  }`}
                >
                  {OUTPUT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          {typeNeedsUrl(newType) && (
          <div>
            <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">SRT URI</label>
            <input
              type="text"
              value={newUrl}
              onChange={(e) => { setNewUrl(e.target.value); setAddUrlError(null) }}
              placeholder="srt://:43524?mode=listener"
              className={inputCls}
            />
            {addUrlError && <p className="text-xs text-red-400 mt-1">{addUrlError}</p>}
          </div>
          )}
          {(newType === 'mpegtssrt' || newType === 'efpsrt') && (
          <div>
            <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Latency (ms)</label>
            <input
              type="number"
              min={20}
              max={8000}
              step={10}
              value={newLatency}
              onChange={(e) => setNewLatency(parseInt(e.target.value, 10) || 125)}
              className={inputCls + ' w-24'}
            />
          </div>
          )}
          <div>
            <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Production</label>
            <select value={newProdId} onChange={(e) => { setNewProdId(e.target.value); setSourceProdId(e.target.value) }}
              className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500">
              <option value="">— none —</option>
              {productions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {typeNeedsDevice(newType) && (
          <div>
            <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Device Number</label>
            {sdiDevices > 0 ? (
            <select
              value={newUrl || '0'}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500"
            >
              {[...Array(sdiDevices)].map((_, i) => (
                <option key={i} value={String(i)}>Device {i}</option>
              ))}
            </select>
            ) : (
            <p className="text-sm text-[--color-amber]">No DeckLink hardware detected. Connect a card to enable SDI output.</p>
            )}
          </div>
          )}
          {/* Video/Audio source — shown for all output types when a production is selected */}
          {newProdId && sourceList.length > 0 && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Video Source</label>
              <select value={newVideoSource} onChange={(e) => setNewVideoSource(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500">
                <option value="pgm">PGM (Program Feed)</option>
                <option value="pgm_clean">Clean PGM (no DSK)</option>
                {sourceList.map((s) => (
                  <option key={s.sourceId} value={s.sourceId}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Audio Source</label>
              <select value={newAudioSource} onChange={(e) => setNewAudioSource(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500">
                <option value="pgm">PGM (Program Mix)</option>
                {sourceList.map((s) => (
                  <option key={s.sourceId} value={s.sourceId}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          )}
          {newType === 'recorder' && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Container</label>
              <select value={newContainer} onChange={(e) => setNewContainer(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500">
                <option value="mp4">MP4</option>
                <option value="mkv">Matroska (MKV)</option>
                <option value="mpegts">MPEG-TS</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Output Directory</label>
              <div className="flex gap-2">
                <input type="text" value={newOutputDir} onChange={(e) => setNewOutputDir(e.target.value)}
                  placeholder="recordings" className={inputCls + ' flex-1'} />
                <button type="button" onClick={() => setDirPickerOpen(true)}
                  className="px-3 py-2 rounded border border-[--color-border-strong] bg-[--color-surface-2] text-xs text-[--color-text-muted] hover:text-orange-500 whitespace-nowrap">Browse...</button>
              </div>
            </div>
            {dirPickerOpen && (
            <div className="border border-[--color-border-strong] rounded p-3 bg-[--color-surface-raised]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[--color-text-muted]">Choose Directory</span>
                <button type="button" onClick={() => setDirPickerOpen(false)}
                  className="text-[--color-text-muted] hover:text-[--color-red] text-lg leading-none">&times;</button>
              </div>
              <DirPicker value={newOutputDir} onChange={(d) => { setNewOutputDir(d); setDirPickerOpen(false) }} onClose={() => setDirPickerOpen(false)} />
            </div>
            )}
          </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { resetAdd(); setAddOpen(false) }}>Cancel</Button>
            <Button variant="active" onClick={() => void handleAdd()} disabled={!newName.trim() || (typeNeedsUrl(newType) && !newUrl.trim())}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      {editTarget && (
        <Modal open title="Edit Output" onClose={() => { setEditTarget(null); setEditUrlError(null) }}>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Name</label>
              <input
                type="text"
                value={editTarget.name}
                onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                className={inputCls}
              />
            </div>
            {typeNeedsUrl(editTarget.outputType) && (
            <div>
              <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">SRT URI</label>
              <input
                type="text"
                value={editTarget.url}
                onChange={(e) => { setEditTarget({ ...editTarget, url: e.target.value }); setEditUrlError(null) }}
                className={inputCls}
              />
              {editUrlError && <p className="text-xs text-red-400 mt-1">{editUrlError}</p>}
            </div>
            )}
            {typeNeedsDevice(editTarget.outputType) && (
            <div>
              <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Device Number</label>
              {sdiDevices > 0 ? (
              <select
                value={editTarget.url || '0'}
                onChange={(e) => setEditTarget({ ...editTarget, url: e.target.value })}
                className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500"
              >
              {[...Array(sdiDevices)].map((_, i) => (
                <option key={i} value={String(i)}>Device {i}</option>
              ))}
              </select>
              ) : (
              <p className="text-sm text-[--color-amber]">No DeckLink hardware detected.</p>
              )}
            </div>
            )}
            {editTarget.outputType === 'recorder' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Container</label>
                <select value={editTarget.container || 'mp4'} onChange={(e) => setEditTarget({ ...editTarget, container: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500">
                  <option value="mp4">MP4</option>
                  <option value="mkv">MKV</option>
                  <option value="mpegts">MPEG-TS</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Output Directory</label>
                <input type="text" value={editTarget.outputDir || ''} onChange={(e) => setEditTarget({ ...editTarget, outputDir: e.target.value })}
                  placeholder="recordings" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Record Source</label>
                <select value={editTarget.videoSource || 'pgm'} onChange={(e) => setEditTarget({ ...editTarget, videoSource: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500">
                  <option value="pgm">PGM</option>
                  <option value="pgm_clean">Clean PGM</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[--color-text-muted] uppercase tracking-wider block mb-1">Audio Source</label>
                <select value={editTarget.audioSource || 'pgm'} onChange={(e) => setEditTarget({ ...editTarget, audioSource: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[--color-surface-raised] border border-[--color-border-strong] text-sm text-[--color-text-primary] focus:outline-none focus:border-orange-500">
                  <option value="pgm">PGM</option>
                </select>
              </div>
            </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => { setEditTarget(null); setEditUrlError(null) }}>Cancel</Button>
              <Button variant="active" onClick={() => void handleEdit()} disabled={!editTarget.name.trim()}>
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
