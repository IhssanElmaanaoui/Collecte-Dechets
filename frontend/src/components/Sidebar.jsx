export function Sidebar({
  mainSection,
  onMainSectionChange,
  currentLevel,
  levels,
  onLevelChange,
  mainSections,
}) {
  return (
    <aside className="w-64 shrink-0 flex flex-col rounded-2xl bg-white backdrop-blur-md border border-slate-200 shadow-xl overflow-hidden">
      <div className="px-5 py-5 border-b border-slate-200">
        <h1 className="text-lg font-bold text-black tracking-tight">
          VillePropre
        </h1>
        <p className="mt-1 text-xs text-black">
          Optimisation des tournées de collecte
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-black mb-3">
          Sections
        </p>
        <ul className="space-y-1.5">
          {(mainSections || []).map((section) => {
            const active = mainSection === section.id
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onMainSectionChange(section.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition-all duration-200 ${
                    active
                      ? 'bg-indigo-500/20 text-black border border-indigo-400/40 shadow-inner'
                      : 'text-black hover:bg-white border border-transparent hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-black">
                      {section.title}
                    </span>
                    {active && (
                      <span className="text-[10px] rounded-full bg-indigo-500/30 px-2 py-0.5 text-black">
                        Actif
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-inherit">{section.subtitle}</p>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar



