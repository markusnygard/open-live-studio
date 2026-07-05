import { useState } from 'react'
import { useAudioStore } from '@/store/audio.store'
import type { OutboundMessage } from '@/hooks/useControllerWs'

interface Props {
  chNum: number
  channelName: string
  send: (msg: OutboundMessage) => void
  onClose: () => void
}

function Knob({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; unit?: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        className="w-12 h-1 accent-blue-500 cursor-pointer appearance-none [writing-mode:vertical-lr] [direction:rtl]"
        style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '60px', width: '12px' }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="text-[10px] text-zinc-400 tabular-nums">{value.toFixed(step < 1 ? 1 : 0)}{unit || ''}</span>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1 cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)}
        className="w-3 h-3 accent-blue-500" />
      <span className="text-[10px] text-zinc-300">{label}</span>
    </label>
  )
}

function Section({ title, color, enabled, onToggle, children }: {
  title: string; color: string; enabled: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border border-zinc-700 rounded p-2 flex-1 min-w-0">
      <button type="button"
        className={`text-[10px] font-semibold w-full text-center py-0.5 rounded mb-1.5 ${enabled ? `bg-${color}-600 text-white` : 'bg-zinc-800 text-zinc-500'}`}
        onClick={onToggle}>{title}</button>
      {children}
    </div>
  )
}

export function ProcessingPopup({ chNum, channelName, send, onClose }: Props) {
  const dynamics = useAudioStore((s) => s.dynamics)
  const key = (prop: string) => dynamics[`ch${chNum}_${prop}`]

  const gain = (key('gain') as number) ?? 0
  const pan = (key('pan') as number) ?? 0
  const hpfOn = (key('hpf_enabled') as boolean) ?? false
  const hpfFreq = (key('hpf_freq') as number) ?? 80
  const gateOn = (key('gate_enabled') as boolean) ?? false
  const gateThr = (key('gate_threshold') as number) ?? -30
  const gateAtk = (key('gate_attack') as number) ?? 5
  const gateRel = (key('gate_release') as number) ?? 100
  const compOn = (key('comp_enabled') as boolean) ?? false
  const compThr = (key('comp_threshold') as number) ?? -12
  const compRatio = (key('comp_ratio') as number) ?? 2
  const compAtk = (key('comp_attack') as number) ?? 5
  const compRel = (key('comp_release') as number) ?? 100
  const compMakeup = (key('comp_makeup') as number) ?? 0
  const compKnee = (key('comp_knee') as number) ?? -6
  const eqOn = (key('eq_enabled') as boolean) ?? false
  const eq1f = (key('eq1_freq') as number) ?? 100
  const eq1g = (key('eq1_gain') as number) ?? 0
  const eq1q = (key('eq1_q') as number) ?? 0.7
  const eq2f = (key('eq2_freq') as number) ?? 400
  const eq2g = (key('eq2_gain') as number) ?? 0
  const eq2q = (key('eq2_q') as number) ?? 0.7
  const eq3f = (key('eq3_freq') as number) ?? 2000
  const eq3g = (key('eq3_gain') as number) ?? 0
  const eq3q = (key('eq3_q') as number) ?? 0.7
  const eq4f = (key('eq4_freq') as number) ?? 8000
  const eq4g = (key('eq4_gain') as number) ?? 0
  const eq4q = (key('eq4_q') as number) ?? 0.7

  const setVal = (prop: string, value: number | boolean) => {
    send({ type: 'AUDIO_DYNAMICS_SET', channel: chNum, property: prop, value })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#12161c] border border-zinc-700 rounded-lg p-4 max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">{channelName} — Processing</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* Gain */}
          <Section title="Gain" color="slate" enabled={true} onToggle={() => {}}>
            <div className="flex justify-center">
              <Knob label="Gain" value={gain} min={-20} max={20} step={0.5} unit="dB" onChange={(v) => setVal('gain', v)} />
            </div>
          </Section>

          {/* HPF */}
          <Section title="HPF" color="purple" enabled={hpfOn} onToggle={() => setVal('hpf_enabled', !hpfOn)}>
            <div className="flex justify-center gap-2">
              <Knob label="Freq" value={hpfFreq} min={20} max={500} step={1} unit="Hz" onChange={(v) => setVal('hpf_freq', v)} />
            </div>
          </Section>

          {/* Gate */}
          <Section title="Gate" color="green" enabled={gateOn} onToggle={() => setVal('gate_enabled', !gateOn)}>
            <div className="flex justify-center gap-2">
              <Knob label="Thr" value={gateThr} min={-60} max={0} step={0.5} unit="dB" onChange={(v) => setVal('gate_threshold', v)} />
              <Knob label="Atk" value={gateAtk} min={0} max={200} step={1} unit="ms" onChange={(v) => setVal('gate_attack', v)} />
              <Knob label="Rel" value={gateRel} min={10} max={1000} step={10} unit="ms" onChange={(v) => setVal('gate_release', v)} />
            </div>
          </Section>

          {/* Compressor */}
          <Section title="Comp" color="orange" enabled={compOn} onToggle={() => setVal('comp_enabled', !compOn)}>
            <div className="flex justify-center gap-2 flex-wrap">
              <Knob label="Thr" value={compThr} min={-60} max={0} step={0.5} unit="dB" onChange={(v) => setVal('comp_threshold', v)} />
              <Knob label="Ratio" value={compRatio} min={1} max={20} step={0.5} unit=":1" onChange={(v) => setVal('comp_ratio', v)} />
              <Knob label="Atk" value={compAtk} min={0} max={200} step={1} unit="ms" onChange={(v) => setVal('comp_attack', v)} />
              <Knob label="Rel" value={compRel} min={10} max={1000} step={10} unit="ms" onChange={(v) => setVal('comp_release', v)} />
              <Knob label="Makeup" value={compMakeup} min={0} max={24} step={0.5} unit="dB" onChange={(v) => setVal('comp_makeup', v)} />
              <Knob label="Knee" value={compKnee} min={-24} max={0} step={0.5} unit="dB" onChange={(v) => setVal('comp_knee', v)} />
            </div>
          </Section>

          {/* EQ */}
          <Section title="EQ" color="blue" enabled={eqOn} onToggle={() => setVal('eq_enabled', !eqOn)}>
            <div className="flex justify-center gap-2">
              {[
                { label: 'Low', freq: eq1f, gain: eq1g, q: eq1q, fp: 'eq1' },
                { label: 'LoMid', freq: eq2f, gain: eq2g, q: eq2q, fp: 'eq2' },
                { label: 'HiMid', freq: eq3f, gain: eq3g, q: eq3q, fp: 'eq3' },
                { label: 'High', freq: eq4f, gain: eq4g, q: eq4q, fp: 'eq4' },
              ].map((b) => (
                <div key={b.fp} className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] text-zinc-500 font-semibold">{b.label}</span>
                  <Knob label="Hz" value={b.freq} min={20} max={20000} step={1} unit="" onChange={(v) => setVal(`${b.fp}_freq`, v)} />
                  <Knob label="dB" value={b.gain} min={-15} max={15} step={0.5} onChange={(v) => setVal(`${b.fp}_gain`, v)} />
                  <Knob label="Q" value={b.q} min={0.1} max={10} step={0.1} onChange={(v) => setVal(`${b.fp}_q`, v)} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
