'use client'

import { useState } from 'react'

type ScenarioId = 'l2-to-l1' | 'l1-to-l2' | 'static' | 'revert'
type OrderingMode = 'builder' | 'metatx'

interface Step {
  num: string
  title: string
  actor: 'composer' | 'l2' | 'l1' | 'both'
  summary: string
  l2: Array<[string, string]>
  l1: Array<[string, string]>
}

interface Scenario {
  id: ScenarioId
  label: string
  repoHref: string
  repoLabel: string
  steps: (opts: { ordering: OrderingMode; missedTx: boolean }) => Step[]
}

const REPO = 'https://github.com/eez-association/eez-core-protocol/blob/main/docs'

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
        actor: 'composer',
        summary: 'Composer runs D (L2) → C (L1), captures returnData, and computes callHash + rollingHash.',
        l2: [
          ['proxyEntryHash', 'callHash(D → C)'],
          ['returnData', '<C return>'],
        ],
        l1: [
          ['proxyEntryHash', 'bytes32(0)  // L2-origin'],
          ['l2ToL1Calls[0]', 'D (R) → C (L1)'],
        ],
      },
      {
        num: '02',
        title: 'Load & run L2',
        actor: 'l2',
        summary: 'System caller loads the entry into EEZL2; D calls C’s proxy and gets C’s returnData immediately.',
        l2: [
          ['EEZL2.loadExecutionTable', 'Active'],
          ['L2 root', 'oldRoot → newRoot'],
        ],
        l1: [
          ['EEZ root[R]', 'oldRoot (pending)'],
          ['status', 'Awaiting batch'],
        ],
      },
      {
        num: '03',
        title: 'Verify & execute L1',
        actor: 'l1',
        summary: 'EEZ.postAndVerifyBatch verifies proofs, calls C via proxy(D, R), checks rollingHash, and commits newRoot.',
        l2: [
          ['Node sync', 'Follows executed L1 event'],
          ['status', 'Finalized with L1'],
        ],
        l1: [
          ['msg.sender at C', 'CrossChainProxy(D, R)'],
          ['rollingHash / root', 'Match ✓ → newRoot'],
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
        actor: 'composer',
        summary: 'Composer simulates Alice (L1, v ETH) → B (L2) and builds paired L1 queued + L2 delivery entries.',
        l2: [
          ['incomingCalls[0]', 'Alice (L1) → B (R), v ETH'],
          ['EEZL2 ETH', 'Needs ≥ v ETH'],
        ],
        l1: [
          ['proxyEntryHash', 'callHash(Alice → B, v)'],
          ['rollupUpdates', 'etherDelta: +v, newRoot'],
        ],
      },
      {
        num: '02',
        title: ordering === 'builder' ? 'Bundle & verify' : 'Meta-tx & verify',
        actor: 'l1',
        summary:
          ordering === 'builder'
            ? 'Builder places postAndVerifyBatch before Alice’s tx in the same L1 block (verified, not yet executed).'
            : 'Poster calls postAndVerifyBatch; EEZ invokes executeMetaCrossChainTransactions() on msg.sender to consume remaining immediate entries in the same tx.',
        l2: [
          ['delivery', 'Waiting on L1 execution'],
          ['L2 root', 'oldRoot'],
        ],
        l1: [
          ['ordering', ordering === 'builder' ? 'Builder bundle (block queue)' : 'IMetaCrossChainReceiver (immediate table)'],
          ['entry state', ordering === 'builder' ? 'Verified in current block' : 'Loaded in transient immediate table'],
        ],
      },
      {
        num: '03',
        title: missedTx ? 'Missed tx (expired)' : 'Execute & deliver',
        actor: missedTx ? 'l1' : 'both',
        summary: missedTx
          ? 'Alice’s tx never hit the proxy in this block. Entry expires unexecuted; L1 and L2 both stay at oldRoot.'
          : 'Alice calls proxy(B) → EEZ credits +v ETH, commits newRoot, returns B’s data → system address delivers on EEZL2.',
        l2: missedTx
          ? [
              ['delivery', 'DROPPED (Verified ≠ Executed)'],
              ['L2 root', 'oldRoot (unchanged)'],
            ]
          : [
              ['executeIncomingCrossChainCall', 'Runs B with v ETH'],
              ['L2 root', 'newRoot (matches L1)'],
            ],
        l1: missedTx
          ? [
              ['entry', 'Expired at block end'],
              ['EEZ root[R]', 'oldRoot (unchanged)'],
            ]
          : [
              ['EEZ root[R]', 'oldRoot → newRoot'],
              ['returned to Alice', '<B return> in same tx'],
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
        actor: 'composer',
        summary: 'Read-only calls use StaticExecutionEntry (L1) or StaticExecutionEntryL2 (L2) with zero ETH and no root updates.',
        l2: [
          ['expectedEntryIndex', 'Pins current EEZL2 cursor'],
          ['state / ETH', 'No writes, 0 ETH'],
        ],
        l1: [
          ['expectedRoots', 'Pins live root[R]'],
          ['rollupUpdates', 'None'],
        ],
      },
      {
        num: '02',
        title: 'Answer directly',
        actor: 'both',
        summary: 'Proxy STATICCALL checks the state pin and returns data immediately. Top-level L1 → L2 reads need no L2 delivery.',
        l2: [
          ['L2 delivery', 'None (for L1 → L2 read)'],
          ['cursor', 'Unchanged'],
        ],
        l1: [
          ['expectedRoots', 'Verified live ✓'],
          ['root / ETH', 'Unchanged'],
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
        actor: 'both',
        summary: 'Target revert bytes are passed back to the caller (success: false) and folded into rollingHash without failing the batch.',
        l2: [
          ['caller entry', 'success: false, returnData: <err>'],
        ],
        l1: [
          ['enclosing entry', 'success: true, returnData: 0x'],
          ['rollingHash', 'Records revert + error bytes'],
        ],
      },
      {
        num: '02',
        title: 'Enclosing reverts',
        actor: 'both',
        summary: 'L2 reverts after L2→L1 → set revertNextNCalls on L1 to roll back state. L1 reverts after L1→L2 → send no L2 delivery.',
        l2: [
          ['L1 caller reverted', 'No L2 delivery sent'],
        ],
        l1: [
          ['L2 caller reverted', 'revertNextNCalls rolls back N calls'],
        ],
      },
    ],
  },
]

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

  return (
    <div className="eezi-shell" role="region" aria-label="Cross-chain flow stepper">
      <div className="eezi-head">
        <span className="eezi-eyebrow">[ FLOW STEPPER ]</span>
        <a className="eezi-link" href={scenario.repoHref} target="_blank" rel="noreferrer">
          {scenario.repoLabel} ↗
        </a>
      </div>

      <div className="eezi-bar">
        <div className="eezi-pill-group" role="tablist" aria-label="Flow scenarios">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scenarioId === s.id}
              className={`eezi-pill ${scenarioId === s.id ? 'is-active' : ''}`}
              onClick={() => selectScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {scenarioId === 'l1-to-l2' && (
          <div className="eezi-inline-opts">
            <div className="eezi-pill-group" role="group" aria-label="Ordering">
              <button type="button" className={`eezi-pill ${ordering === 'builder' ? 'is-active' : ''}`} aria-pressed={ordering === 'builder'} onClick={() => setOrdering('builder')}>
                Builder
              </button>
              <button type="button" className={`eezi-pill ${ordering === 'metatx' ? 'is-active' : ''}`} aria-pressed={ordering === 'metatx'} onClick={() => setOrdering('metatx')}>
                Meta-tx
              </button>
            </div>
            <label className="eezi-toggle">
              <input type="checkbox" checked={missedTx} onChange={(e) => setMissedTx(e.target.checked)} />
              <span>User tx never lands</span>
            </label>
          </div>
        )}
      </div>

      <div className="eezi-steps-strip" role="group" aria-label="Steps">
        {steps.map((s, i) => (
          <button
            key={s.num}
            type="button"
            className={`eezi-step-chip ${i === idx ? 'is-active' : ''} ${i < idx ? 'is-done' : ''}`}
            onClick={() => setStepIdx(i)}
          >
            <span className="eezi-step-num">{s.num}</span>
            <span>{s.title}</span>
          </button>
        ))}
      </div>

      <div className="eezi-lanes-compact" aria-label="Active actors">
        <span className={`eezi-lane-dot ${step.actor === 'l2' || step.actor === 'both' ? 'is-lit' : ''}`}>L2 · EEZL2</span>
        <span className="eezi-lane-sep">↔</span>
        <span className={`eezi-lane-dot ${step.actor === 'composer' ? 'is-lit' : ''}`}>Composer / Proof system(s)</span>
        <span className="eezi-lane-sep">↔</span>
        <span className={`eezi-lane-dot ${step.actor === 'l1' || step.actor === 'both' ? 'is-lit' : ''}`}>L1 · EEZ</span>
      </div>

      <p className="eezi-summary">{step.summary}</p>

      <div className="eezi-entries">
        <div className="eezi-entry-box">
          <div className="eezi-entry-head">L2</div>
          {step.l2.map(([k, v]) => (
            <div key={k} className="eezi-entry-row">
              <span className="eezi-entry-k">{k}</span>
              <span className="eezi-entry-v">{v}</span>
            </div>
          ))}
        </div>
        <div className="eezi-entry-box">
          <div className="eezi-entry-head">L1</div>
          {step.l1.map(([k, v]) => (
            <div key={k} className="eezi-entry-row">
              <span className="eezi-entry-k">{k}</span>
              <span className="eezi-entry-v">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="eezi-pager">
        <button type="button" className="eezi-nav-btn" disabled={idx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
          ← Prev
        </button>
        <span className="eezi-meta">{idx + 1} / {steps.length}</span>
        <button type="button" className="eezi-nav-btn" disabled={idx === steps.length - 1} onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}>
          Next →
        </button>
      </div>
    </div>
  )
}
