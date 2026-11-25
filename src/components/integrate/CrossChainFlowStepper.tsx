'use client'

import { useId, useState, type KeyboardEvent } from 'react'

type ScenarioId = 'l2-to-l1' | 'l1-to-l2' | 'static' | 'revert' | 'l2-to-l2'
type OrderingMode = 'builder' | 'metatx'
type ValueTone = 'ok' | 'muted' | 'warn' | 'danger'
type ActorId = 'l2' | 'composer' | 'l1'

interface EntryField {
  k: string
  v: string
  tone: ValueTone
  changed?: boolean
}

interface FlowArrow {
  from: ActorId
  to: ActorId
  label: string
  tone: 'ok' | 'warn' | 'danger' | 'muted'
  dashed?: boolean
  broken?: boolean
}

interface Step {
  num: string
  title: string
  activeActors: ActorId[]
  statusTone?: 'ok' | 'warn' | 'danger'
  arrow: FlowArrow
  summary: string
  /** Overrides the L2 actor label, for flows that involve two rollups. */
  l2Label?: string
  l2: EntryField[]
  l1: EntryField[]
}

interface Scenario {
  id: ScenarioId
  label: string
  repoHref: string
  repoLabel: string
  steps: (opts: { ordering: OrderingMode; missedTx: boolean }) => Step[]
}

const REPO = 'https://github.com/eez-association/eez-core-protocol/blob/main/docs'

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const SCENARIOS: Scenario[] = [
  {
    id: 'l2-to-l1',
    label: 'L2 → L1',
    repoHref: `${REPO}/EXECUTION_ENTRY_SPEC.md`,
    repoLabel: 'EXECUTION_ENTRY_SPEC.md',
    steps: () => [
      {
        num: '01',
        title: 'Simulate',
        activeActors: ['composer', 'l2', 'l1'],
        arrow: { from: 'l2', to: 'l1', label: 'simulate D → C · compute rollingHash', tone: 'muted', dashed: true },
        summary: 'Composer simulates D (L2) calling C (L1), captures returnData, and computes callHash + rollingHash for both tables.',
        l2: [
          { k: 'proxyEntryHash', v: 'callHash(D → C)', tone: 'ok', changed: true },
          { k: 'returnData', v: '<C return>', tone: 'ok', changed: true },
        ],
        l1: [
          { k: 'proxyEntryHash', v: 'bytes32(0)  // L2-origin', tone: 'muted' },
          { k: 'l2ToL1Calls[0]', v: 'D (R) → C (L1)', tone: 'ok', changed: true },
        ],
      },
      {
        num: '02',
        title: 'Load & run L2',
        activeActors: ['composer', 'l2'],
        arrow: { from: 'composer', to: 'l2', label: 'loadExecutionTable → D calls proxy(C)', tone: 'ok' },
        summary: 'System caller loads the entry into EEZL2; D calls C’s proxy and receives C’s simulated returnData in the same L2 tx.',
        l2: [
          { k: 'EEZL2.loadExecutionTable', v: 'Active (entry loaded)', tone: 'ok', changed: true },
          { k: 'L2 root', v: 'oldRoot → newRoot', tone: 'ok', changed: true },
        ],
        l1: [
          { k: 'EEZ root[R]', v: 'oldRoot (pending)', tone: 'muted' },
          { k: 'status', v: 'Awaiting batch on L1', tone: 'muted' },
        ],
      },
      {
        num: '03',
        title: 'Verify & execute L1',
        activeActors: ['composer', 'l1'],
        arrow: { from: 'composer', to: 'l1', label: 'postAndVerifyBatch → proxy(D, R) calls C', tone: 'ok' },
        summary: 'EEZ.postAndVerifyBatch verifies proofs, calls C via CrossChainProxy(D, R), checks rollingHash, and commits newRoot.',
        l2: [
          { k: 'Node sync', v: 'Follows executed L1 event', tone: 'ok', changed: true },
          { k: 'status', v: 'Finalized with L1', tone: 'ok' },
        ],
        l1: [
          { k: 'msg.sender at C', v: 'CrossChainProxy(D, R)', tone: 'ok', changed: true },
          { k: 'rollingHash / root', v: 'Match · root → newRoot', tone: 'ok', changed: true },
        ],
      },
    ],
  },
  {
    id: 'l1-to-l2',
    label: 'L1 → L2',
    repoHref: `${REPO}/CORE_PROTOCOL_SPEC.md`,
    repoLabel: 'CORE_PROTOCOL_SPEC.md',
    steps: ({ ordering, missedTx }) => [
      {
        num: '01',
        title: 'Simulate',
        activeActors: ['composer', 'l1', 'l2'],
        arrow: { from: 'l1', to: 'l2', label: 'simulate Alice (v ETH) → B · pair entries', tone: 'muted', dashed: true },
        summary: 'Composer simulates Alice (L1, v ETH) calling B (L2) and builds paired L1 queued and L2 delivery entries.',
        l2: [
          { k: 'incomingCalls[0]', v: 'Alice (L1) → B (R), v ETH', tone: 'ok', changed: true },
          { k: 'EEZL2 ETH', v: 'Needs ≥ v ETH pooled', tone: 'warn' },
        ],
        l1: [
          { k: 'proxyEntryHash', v: 'callHash(Alice → B, v)', tone: 'ok', changed: true },
          { k: 'rollupUpdates', v: 'etherDelta: +v, newRoot', tone: 'ok', changed: true },
        ],
      },
      {
        num: '02',
        title: ordering === 'builder' ? 'Bundle & verify' : 'Meta-tx & verify',
        activeActors: ['composer', 'l1'],
        arrow: {
          from: 'composer',
          to: 'l1',
          label: ordering === 'builder' ? 'builder bundle: verify before Alice tx' : 'postAndVerifyBatch → meta receiver callback',
          tone: 'warn',
        },
        summary:
          ordering === 'builder'
            ? 'Builder places postAndVerifyBatch before Alice’s tx in the same L1 block. Entry is verified for this block only — not yet executed.'
            : 'Poster calls postAndVerifyBatch; EEZ calls executeMetaCrossChainTransactions() on msg.sender to consume remaining immediate entries in the same tx.',
        l2: [
          { k: 'delivery', v: 'Waiting on L1 execution', tone: 'muted' },
          { k: 'L2 root', v: 'oldRoot (unchanged)', tone: 'muted' },
        ],
        l1: [
          {
            k: 'ordering',
            v: ordering === 'builder' ? 'Builder bundle (block queue)' : 'IMetaCrossChainReceiver (immediate)',
            tone: 'ok',
            changed: true,
          },
          {
            k: 'entry state',
            v: ordering === 'builder' ? 'Verified in current block only' : 'Loaded in transient immediate table',
            tone: 'warn',
            changed: true,
          },
        ],
      },
      {
        num: '03',
        title: missedTx ? (ordering === 'builder' ? 'Missed tx (expired)' : 'Missed tx (wiped)') : 'Execute & deliver',
        activeActors: missedTx ? ['l1'] : ['l1', 'l2'],
        statusTone: missedTx ? 'danger' : 'ok',
        arrow: missedTx
          ? {
              from: 'l1',
              to: 'l2',
              label:
                ordering === 'builder'
                  ? 'Alice tx never reached proxy · entry expired'
                  : 'meta hook skipped proxy(B) · transient table wiped',
              tone: 'danger',
              dashed: true,
              broken: true,
            }
          : { from: 'l1', to: 'l2', label: 'Alice → proxy(B) · executeIncomingCrossChainCall', tone: 'ok' },
        summary: missedTx
          ? ordering === 'builder'
            ? 'Alice’s tx never reached the proxy in this L1 block. The queued entry expires unexecuted at block end (Verified ≠ Executed); L1 and L2 both stay at oldRoot.'
            : 'The meta receiver never called proxy(B) during executeMetaCrossChainTransactions(). EEZ wipes the transient immediate table when postAndVerifyBatch returns (Verified ≠ Executed); L1 and L2 both stay at oldRoot.'
          : 'Alice calls proxy(B) → EEZ credits +v ETH, commits newRoot, returns B’s data in the same tx → system address delivers on EEZL2.',
        l2: missedTx
          ? [
              { k: 'delivery', v: 'DROPPED (Verified ≠ Executed)', tone: 'danger', changed: true },
              { k: 'L2 root', v: 'oldRoot (unchanged)', tone: 'muted' },
            ]
          : [
              { k: 'executeIncomingCrossChainCall', v: 'Runs B with v ETH', tone: 'ok', changed: true },
              { k: 'L2 root', v: 'newRoot (matches L1)', tone: 'ok', changed: true },
            ],
        l1: missedTx
          ? [
              {
                k: 'entry',
                v: ordering === 'builder' ? 'Expired at block end' : 'Wiped after postAndVerifyBatch',
                tone: 'danger',
                changed: true,
              },
              { k: 'EEZ root[R]', v: 'oldRoot (unchanged)', tone: 'muted' },
            ]
          : [
              { k: 'EEZ root[R]', v: 'oldRoot → newRoot', tone: 'ok', changed: true },
              { k: 'returned to Alice', v: '<B return> in same tx', tone: 'ok', changed: true },
            ],
      },
    ],
  },
  {
    id: 'static',
    label: 'Static read',
    repoHref: `${REPO}/STATIC_ENTRY.md`,
    repoLabel: 'STATIC_ENTRY.md',
    steps: () => [
      {
        num: '01',
        title: 'Pin state',
        activeActors: ['composer', 'l1', 'l2'],
        arrow: { from: 'l1', to: 'l2', label: 'StaticExecutionEntry · pin expectedRoots & cursor', tone: 'muted', dashed: true },
        summary: 'Read-only calls use StaticExecutionEntry (L1) or StaticExecutionEntryL2 (L2) with zero ETH and no root updates.',
        l2: [
          { k: 'expectedEntryIndex', v: 'Pins current EEZL2 cursor', tone: 'ok', changed: true },
          { k: 'state / ETH', v: 'No writes, 0 ETH', tone: 'muted' },
        ],
        l1: [
          { k: 'expectedRoots', v: 'Pins live root[R]', tone: 'ok', changed: true },
          { k: 'rollupUpdates', v: 'None', tone: 'muted' },
        ],
      },
      {
        num: '02',
        title: 'Answer directly',
        activeActors: ['l1'],
        arrow: { from: 'l1', to: 'l1', label: 'STATICCALL checks expectedRoots · returns immediately', tone: 'ok' },
        summary: 'Proxy STATICCALL checks the state pin and returns data immediately. Top-level L1 → L2 reads need no L2 delivery.',
        l2: [
          { k: 'L2 delivery', v: 'None (for L1 → L2 read)', tone: 'muted' },
          { k: 'cursor', v: 'Unchanged', tone: 'muted' },
        ],
        l1: [
          { k: 'expectedRoots', v: 'Verified live', tone: 'ok', changed: true },
          { k: 'root / ETH', v: 'Unchanged', tone: 'muted' },
        ],
      },
    ],
  },
  {
    id: 'revert',
    label: 'Reverts',
    repoHref: `${REPO}/CALL_PATTERN_LIMITS.md`,
    repoLabel: 'CALL_PATTERN_LIMITS.md',
    steps: () => [
      {
        num: '01',
        title: 'Target reverts',
        activeActors: ['l2', 'l1'],
        statusTone: 'warn',
        arrow: { from: 'l1', to: 'l2', label: 'success: false + revert bytes folded into rollingHash', tone: 'warn', dashed: true },
        summary: 'Target revert bytes return to the caller (success: false) and fold into rollingHash without failing the batch.',
        l2: [
          { k: 'caller entry', v: 'success: false, returnData: <err>', tone: 'danger', changed: true },
        ],
        l1: [
          { k: 'enclosing entry', v: 'success: true, returnData: 0x', tone: 'ok' },
          { k: 'rollingHash', v: 'Records revert + error bytes', tone: 'warn', changed: true },
        ],
      },
      {
        num: '02',
        title: 'Enclosing reverts',
        activeActors: ['l2', 'l1'],
        statusTone: 'danger',
        arrow: { from: 'l2', to: 'l1', label: 'revertNextNCalls rolls back L1 / omit L2 delivery', tone: 'danger', dashed: true, broken: true },
        summary: 'If L2 reverts after L2→L1, set revertNextNCalls on L1 to roll back state. If L1 reverts after L1→L2, send no L2 delivery.',
        l2: [
          { k: 'L1 caller reverted', v: 'No L2 delivery sent', tone: 'danger', changed: true },
        ],
        l1: [
          { k: 'L2 caller reverted', v: 'revertNextNCalls rolls back N calls', tone: 'warn', changed: true },
        ],
      },
    ],
  },
  {
    id: 'l2-to-l2',
    label: 'L2 ↔ L2',
    repoHref: `${REPO}/CORE_PROTOCOL_SPEC.md`,
    repoLabel: 'CORE_PROTOCOL_SPEC.md',
    steps: () => [
      {
        num: '01',
        title: 'Agree',
        activeActors: ['composer', 'l2'],
        statusTone: 'warn',
        l2Label: 'Rollup A · Rollup B',
        arrow: { from: 'composer', to: 'l2', label: 'both chains agree on the call and its result', tone: 'warn', dashed: true },
        summary: 'In progress. Contract E on rollup A calls contract F on rollup B. Both chains must agree on the call and its result before anything is posted.',
        l2: [
          { k: 'Rollup A', v: 'E calls proxy(F)', tone: 'ok', changed: true },
          { k: 'Rollup B', v: 'F runs, called by proxy(E, A)', tone: 'ok', changed: true },
        ],
        l1: [
          { k: 'EEZ root[A], root[B]', v: 'oldRoot (pending)', tone: 'muted' },
          { k: 'status', v: 'Awaiting batch on L1', tone: 'muted' },
        ],
      },
      {
        num: '02',
        title: 'Verify both on L1',
        activeActors: ['composer', 'l1'],
        statusTone: 'warn',
        l2Label: 'Rollup A · Rollup B',
        arrow: { from: 'composer', to: 'l1', label: 'postAndVerifyBatch · one batch lists both rollups', tone: 'warn', dashed: true },
        summary: 'In progress. One batch lists both rollups. Each is approved under its own rollup contract’s rule, and the entry carries a root update for every rollup involved.',
        l2: [
          { k: 'Rollup A', v: 'Awaiting L1', tone: 'muted' },
          { k: 'Rollup B', v: 'Awaiting L1', tone: 'muted' },
        ],
        l1: [
          { k: 'rollupUpdates', v: '[A, B]  // ascending rollup ID', tone: 'ok', changed: true },
          { k: 'approval', v: 'A’s rule and B’s rule', tone: 'ok', changed: true },
        ],
      },
      {
        num: '03',
        title: 'Follow on both',
        activeActors: ['l1', 'l2'],
        statusTone: 'warn',
        l2Label: 'Rollup A · Rollup B',
        arrow: { from: 'l1', to: 'l2', label: 'both chains follow the executed update', tone: 'warn', dashed: true },
        summary: 'In progress. Both chains follow the update that executed on L1. eez-rollupX and eez-rollup0 support L2→L1 and L1→L2 today; calls between two L2s are being built.',
        l2: [
          { k: 'Rollup A', v: 'Follows executed L1 event', tone: 'ok', changed: true },
          { k: 'Rollup B', v: 'Follows executed L1 event', tone: 'ok', changed: true },
        ],
        l1: [
          { k: 'root[A], root[B]', v: 'oldRoot → newRoot', tone: 'ok', changed: true },
          { k: 'status', v: 'In progress in the reference rollups', tone: 'warn' },
        ],
      },
    ],
  },
]

const NODE_X: Record<ActorId, number> = {
  l2: 92,
  composer: 320,
  l1: 548,
}

const TONE_STROKE: Record<FlowArrow['tone'], string> = {
  ok: '#3BE57E',
  warn: '#f5c36c',
  danger: '#ff8a80',
  muted: '#7f8999',
}

function SequenceDiagram({ step }: { step: Step }) {
  const markerId = useId()
  const { activeActors, arrow, statusTone } = step
  const color = TONE_STROKE[arrow.tone]

  const isActive = (id: ActorId) => activeActors.includes(id)
  const nodeColor = (id: ActorId) => {
    if (!isActive(id)) return '#2a2a2a'
    if (statusTone === 'danger' && id === 'l1') return '#ff8a80'
    if (statusTone === 'warn') return '#f5c36c'
    return '#3BE57E'
  }
  const nodeFill = (id: ActorId) => {
    if (!isActive(id)) return '#0d0d0d'
    if (statusTone === 'danger' && id === 'l1') return 'rgba(255, 138, 128, 0.08)'
    if (statusTone === 'warn') return 'rgba(245, 195, 108, 0.08)'
    return 'rgba(59, 229, 126, 0.08)'
  }

  const renderArrow = () => {
    const y = 30
    if (arrow.from === arrow.to) {
      const cx = NODE_X[arrow.from]
      return (
        <g>
          <path
            d={`M ${cx - 32} 50 C ${cx - 32} 18, ${cx + 32} 18, ${cx + 32} 45`}
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            markerEnd={`url(#${markerId})`}
          />
          <text x={320} y={14} textAnchor="middle" fill={color} fontSize="10.5" fontFamily="var(--vocs-font-family-mono)">
            {arrow.label}
          </text>
        </g>
      )
    }

    const x1 = NODE_X[arrow.from]
    const x2 = NODE_X[arrow.to]
    const midX = (x1 + x2) / 2
    const dir = x2 > x1 ? 1 : -1
    const r = 6

    return (
      <g>
        <path
          d={`M ${x1} 50 V ${y + r} Q ${x1} ${y} ${x1 + dir * r} ${y} H ${x2 - dir * r} Q ${x2} ${y} ${x2} ${y + r} V 44`}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeDasharray={arrow.dashed ? '4 4' : undefined}
          markerEnd={arrow.broken ? undefined : `url(#${markerId})`}
        />
        {arrow.broken && (
          <g transform={`translate(${midX}, ${y})`}>
            <circle r="8.5" fill="#161616" stroke={color} strokeWidth="1.4" />
            <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          </g>
        )}
        <text x={320} y={14} textAnchor="middle" fill={color} fontSize="10.5" fontFamily="var(--vocs-font-family-mono)">
          {arrow.label}
        </text>
      </g>
    )
  }

  const nodes: Array<{ id: ActorId; label: string; sub: string }> = [
    { id: 'l2', label: step.l2Label ?? 'L2 · EEZL2', sub: step.l2Label ? 'Two rollups' : 'Rollup' },
    { id: 'composer', label: 'Composer / Prover', sub: 'Off-chain' },
    { id: 'l1', label: 'L1 · EEZ', sub: 'Ethereum' },
  ]

  return (
    <div className="eezi-diagram-wrap">
      <svg className="eezi-diagram-svg" viewBox="0 0 640 98" role="img" aria-label={arrow.label}>
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>

        {/* Quiet baseline connectors */}
        <line x1="168" y1="71" x2="232" y2="71" stroke="#222" strokeWidth="1" strokeDasharray="2 3" />
        <line x1="408" y1="71" x2="472" y2="71" stroke="#222" strokeWidth="1" strokeDasharray="2 3" />

        {renderArrow()}

        {nodes.map((n) => {
          const cx = NODE_X[n.id]
          const w = n.id === 'composer' ? 176 : 152
          const active = isActive(n.id)
          return (
            <g key={n.id} transform={`translate(${cx - w / 2}, 50)`}>
              <rect
                width={w}
                height={42}
                rx={8}
                fill={nodeFill(n.id)}
                stroke={nodeColor(n.id)}
                strokeWidth={active ? 1.4 : 1}
              />
              <text
                x={w / 2}
                y={19}
                textAnchor="middle"
                fill={active ? '#ffffff' : '#8b95a5'}
                fontSize="11.5"
                fontWeight={active ? 600 : 400}
                fontFamily="var(--vocs-font-family-mono)"
              >
                {n.label}
              </text>
              <text
                x={w / 2}
                y={33}
                textAnchor="middle"
                fill={active ? '#9aa3b3' : '#5e6673'}
                fontSize="9.5"
                fontFamily="var(--vocs-font-family-mono)"
              >
                {n.sub}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function CrossChainFlowStepper() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('l2-to-l1')
  const [ordering, setOrdering] = useState<OrderingMode>('builder')
  const [missedTx, setMissedTx] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]
  const steps = scenario.steps({ ordering, missedTx })
  const idx = Math.min(stepIdx, steps.length - 1)
  const step = steps[idx]

  const selectScenario = (id: ScenarioId) => {
    setScenarioId(id)
    setStepIdx(0)
    if (id !== 'l1-to-l2') setMissedTx(false)
  }

  const toggleMissedTx = () => {
    const next = !missedTx
    setMissedTx(next)
    // Jump directly to Step 03 so the failure outcome is immediately visible.
    if (next) setStepIdx(steps.length - 1)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setStepIdx((i) => Math.min(steps.length - 1, i + 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setStepIdx((i) => Math.max(0, i - 1))
    }
  }

  return (
    <div className="eezi-shell" role="region" aria-label="Cross-chain flow stepper" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="eezi-head">
        <span className="eezi-eyebrow">[ FLOW STEPPER ]</span>
        <a className="eezi-link" href={scenario.repoHref} target="_blank" rel="noreferrer">
          <span>{scenario.repoLabel}</span>
          <ExternalIcon />
        </a>
      </div>

      <div className="eezi-bar">
        <div className="eezi-seg" role="tablist" aria-label="Flow scenarios">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scenarioId === s.id}
              className={`eezi-seg-btn ${scenarioId === s.id ? 'is-active' : ''}`}
              onClick={() => selectScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {scenarioId === 'l1-to-l2' && (
          <div className="eezi-inline-opts">
            <div className="eezi-seg" role="group" aria-label="Ordering">
              <button type="button" className={`eezi-seg-btn ${ordering === 'builder' ? 'is-active' : ''}`} aria-pressed={ordering === 'builder'} onClick={() => setOrdering('builder')}>
                Builder
              </button>
              <button type="button" className={`eezi-seg-btn ${ordering === 'metatx' ? 'is-active' : ''}`} aria-pressed={ordering === 'metatx'} onClick={() => setOrdering('metatx')}>
                Meta-tx
              </button>
            </div>
            <button
              type="button"
              className={`eezi-fault-btn ${missedTx ? 'is-on' : ''}`}
              aria-pressed={missedTx}
              onClick={toggleMissedTx}
            >
              <span className="eezi-fault-dot" aria-hidden="true" />
              <span>User tx never lands</span>
            </button>
          </div>
        )}
      </div>

      <div className="eezi-steps-strip" role="group" aria-label="Steps">
        {steps.map((s, i) => {
          const toneClass = s.statusTone ? `is-${s.statusTone}` : ''
          return (
            <button
              key={`${scenarioId}-${s.num}`}
              type="button"
              aria-current={i === idx ? 'step' : undefined}
              className={`eezi-step-chip ${toneClass} ${i === idx ? 'is-active' : ''} ${i < idx ? 'is-done' : ''}`}
              onClick={() => setStepIdx(i)}
            >
              <span className="eezi-step-num">{s.num}</span>
              <span>{s.title}</span>
            </button>
          )
        })}
      </div>

      <SequenceDiagram step={step} />

      <div role="tabpanel" aria-live="polite" className="eezi-flow-body">
        <p className="eezi-summary">{step.summary}</p>

        <div className="eezi-entries">
          <div className="eezi-entry-box">
            <div className="eezi-entry-head">
              <span>{step.l2Label ?? 'L2 · EEZL2'}</span>
              {step.activeActors.includes('l2') && <span className="eezi-live-dot" aria-hidden="true" />}
            </div>
            {step.l2.map((item) => (
              <div key={item.k} className={`eezi-entry-row ${item.changed ? 'is-changed' : ''}`}>
                <span className="eezi-entry-k">{item.k}</span>
                <span className={`eezi-entry-v eezi-val--${item.tone}`}>{item.v}</span>
              </div>
            ))}
          </div>

          <div className="eezi-entry-box">
            <div className="eezi-entry-head">
              <span>L1 · EEZ</span>
              {step.activeActors.includes('l1') && (
                <span className={`eezi-live-dot ${step.statusTone === 'danger' ? 'is-danger' : ''}`} aria-hidden="true" />
              )}
            </div>
            {step.l1.map((item) => (
              <div key={item.k} className={`eezi-entry-row ${item.changed ? 'is-changed' : ''}`}>
                <span className="eezi-entry-k">{item.k}</span>
                <span className={`eezi-entry-v eezi-val--${item.tone}`}>{item.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="eezi-pager">
        <button type="button" className="eezi-nav-btn" disabled={idx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
          ← Prev
        </button>
        <span className="eezi-meta">
          {idx + 1} / {steps.length} <span className="eezi-kbd-hint">· ← / → keys</span>
        </span>
        <button type="button" className="eezi-nav-btn" disabled={idx === steps.length - 1} onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}>
          Next →
        </button>
      </div>
    </div>
  )
}
