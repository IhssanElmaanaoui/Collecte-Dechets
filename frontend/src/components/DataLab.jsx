/**
 * Data Lab : analyseur JSON – charger/coller un JSON, profiler sa structure.
 * Même fonction que la référence EcoRoute (sans reprendre son design).
 */
import { useState, useCallback } from 'react'

function profileObject(obj, depth = 0, maxDepth = 4) {
  if (depth > maxDepth) return { type: '…', truncated: true }
  if (obj === null) return { type: 'null' }
  if (Array.isArray(obj)) {
    const len = obj.length
    const sample = len > 0 ? profileObject(obj[0], depth + 1, maxDepth) : { type: 'empty' }
    return { type: 'array', length: len, sample }
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj)
    const children = {}
    keys.forEach((k) => {
      children[k] = profileObject(obj[k], depth + 1, maxDepth)
    })
    return { type: 'object', keys, children }
  }
  return { type: typeof obj, value: String(obj).slice(0, 50) }
}

function ProfileView({ profile, name = '', indent = 0 }) {
  if (!profile) return null
  const pad = '  '.repeat(indent)
  if (profile.type === 'object') {
    return (
      <div className="text-left">
        <span className="text-black">{pad}{name && `${name}: `}</span>
        <span className="text-black">{'{}'}</span>
        <span className="text-black text-xs"> {profile.keys?.length ?? 0} keys</span>
        <div className="pl-2 border-l border-slate-300 ml-2">
          {profile.keys?.map((k) => (
            <ProfileView key={k} profile={profile.children?.[k]} name={k} indent={indent + 1} />
          ))}
        </div>
      </div>
    )
  }
  if (profile.type === 'array') {
    return (
      <div>
        <span className="text-black">{pad}{name && `${name}: `}</span>
        <span className="text-black">[]</span>
        <span className="text-black text-xs"> length {profile.length ?? 0}</span>
        {profile.sample && (
          <div className="pl-2 border-l border-slate-300 ml-2">
            <ProfileView profile={profile.sample} name="[0]" indent={indent + 1} />
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="text-black text-sm">
      {pad}{name && `${name}: `}<span className="text-black">{profile.type}</span>
      {profile.value != null && <span className="text-black"> "{profile.value}"</span>}
    </div>
  )
}

export function DataLab() {
  const [rawInput, setRawInput] = useState('')
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)

  const analyze = useCallback(() => {
    setError(null)
    setProfile(null)
    const str = rawInput.trim()
    if (!str) {
      setError('Collez ou chargez un JSON.')
      return
    }
    try {
      const data = JSON.parse(str)
      setProfile(profileObject(data))
    } catch (e) {
      setError(e.message || 'JSON invalide')
    }
  }, [rawInput])

  const reset = useCallback(() => {
    setRawInput('')
    setProfile(null)
    setError(null)
  }, [])

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRawInput(ev.target?.result ?? '')
      setError(null)
      setProfile(null)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold text-black">
        Analyseur JSON
      </h2>
      <p className="text-sm text-black">
        Chargez ou collez un JSON pour profiler sa structure et accélérer vos analyses d'exécution.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={analyze}
          className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition-colors"
        >
          Analyser JSON
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-black hover:bg-slate-50 transition-colors"
        >
          Réinitialiser
        </button>
        <label className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-black hover:bg-slate-50 cursor-pointer transition-colors">
          Charger un fichier
          <input type="file" accept=".json" className="hidden" onChange={handleFile} />
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-black mb-1">JSON (coller ou charger)</label>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder='{"plan": {}, "tournees": []}'
          className="w-full h-40 rounded-xl bg-white border border-slate-300 p-3 text-sm text-black font-mono placeholder:text-black focus:outline-none focus:ring-1 focus:ring-slate-400"
          spellCheck={false}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 rounded-lg bg-red-900/20 border border-red-800/50 px-3 py-2">
          {error}
        </p>
      )}

      {profile && (
        <div className="rounded-xl bg-white border border-slate-300 p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-black mb-3">Structure profilée</h3>
          <div className="text-xs font-mono">
            <ProfileView profile={profile} />
          </div>
        </div>
      )}
    </div>
  )
}

export default DataLab

