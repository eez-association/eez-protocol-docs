'use client'

import { useState } from 'react'

type ChainType = 'existing' | 'new'
type Stage = 's1' | 's2' | 's3' | 's4'
type ProverMode = 'ecdsa' | 'zk'

interface Row {
  id: string
  layer: 'L1' | 'L2' | 'Off-chain' | 'Prover'
  stepNum: string
  stepHref: string
  addedBadge?: string
  what: string
  repoLabel: string
  repoHref: string
}

const REPO = 'https://github.com/eez-association/eez-core-protocol/blob/main'
const ORG = 'https://github.com/eez-association'

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2.25 6.5L4.75 9L9.75 3.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 4V2.7A1.2 1.2 0 0 0 6.8 1.5H2.7A1.2 1.2 0 0 0 1.5 2.7V6.8A1.2 1.2 0 0 0 2.7 8H4" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 2.25L14.25 13.25H1.75L8 2.25Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M8 6.25V9.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  )
}

export function IntegrationConfigurator() {
  const [chain, setChain] = useState<ChainType>('existing')
  const [stage, setStage] = useState<Stage>('s2')
  const [prover, setProver] = useState<ProverMode>('ecdsa')
  const [copied, setCopied] = useState(false)

  const initialRootPhrase =
    chain === 'existing' ? 'initialRoot = starting block hash' : 'genesis initialRoot'

  // Stage 4 (L2↔L2) builds on the stage 3 checklist and adds one in-progress row.
  const base: Stage = stage === 's4' ? 's3' : stage

  const rows: Row[] = [
    {
      id: 'register',
      layer: 'L1',
      stepNum: 'Step 1',
      stepHref: '#1-register-on-l1',
      what:
        prover === 'ecdsa'
          ? `Deploy ECDSAProofSystem + Rollup (per-rollup threshold; may be 0) and register via EEZ.registerRollup with ${initialRootPhrase}.`
          : `Deploy verifier(s) + Rollup (vkeys, per-rollup threshold; may be 0) and register via EEZ.registerRollup with ${initialRootPhrase}.`,
      repoLabel: 'deployment/README.md',
      repoHref: `${REPO}/deployment/README.md#individual-deployments`,
    },
    {
      id: 'batches',
      layer: 'L1',
      stepNum: base === 's3' ? 'Step 2 & 4' : 'Step 2',
      stepHref: base === 's3' ? '#4-add-cross-chain-calls' : '#2-submit-state-updates',
      addedBadge: base === 's2' ? '+ Stage 2' : base === 's3' ? '+ Stage 3' : undefined,
      what:
        base === 's1'
          ? 'Post root-only batches via EEZ.postAndVerifyBatch (currentRoot, newRoot, etherDelta).'
          : base === 's2'
            ? 'Post batches carrying L2→L1 ExecutionEntry items via EEZ.postAndVerifyBatch.'
            : 'Verify batch before the user L1 tx in the same block via builder bundle or IMetaCrossChainReceiver.',
      repoLabel: 'src/EEZ.sol',
      repoHref: `${REPO}/src/EEZ.sol`,
    },
    {
      id: 'l2',
      layer: 'L2',
      stepNum: base === 's1' ? 'Step 2' : 'Step 4',
      stepHref: base === 's1' ? '#2-submit-state-updates' : '#4-add-cross-chain-calls',
      addedBadge: base === 's2' ? '+ Stage 2' : base === 's3' ? '+ Stage 3' : undefined,
      what:
        base === 's1'
          ? chain === 'existing'
            ? 'Follow executed L1 updates and reconcile EEZ finality with your existing L1 reorg path.'
            : 'Follow executed L1 updates and handle L1 reorgs from genesis.'
          : base === 's2'
            ? 'Deploy EEZL2 with rollupId + protected SYSTEM_ADDRESS for loadExecutionTable.'
            : 'Deploy EEZL2 + loadExecutionTable + executeIncomingCrossChainCall + fund pooled ETH for incoming value.',
      repoLabel: 'src/L2/EEZL2.sol',
      repoHref: `${REPO}/src/L2/EEZL2.sol`,
    },
    {
      id: 'offchain',
      layer: 'Off-chain',
      stepNum: 'Step 3',
      stepHref: '#3-publish-your-chain-data',
      addedBadge: base === 's2' ? '+ Stage 2' : base === 's3' ? '+ Stage 3' : undefined,
      what:
        base === 's1'
          ? 'Publish DA (EEZ blob format or custom) + batch poster + proof system(s).'
          : base === 's2'
            ? 'Composer (simulate L2→L1 + build entries) + DA publisher + same-block proving.'
            : 'Bidirectional composer (L2→L1 & L1→L2 entries) + DA publisher + same-block proving.',
      repoLabel: 'EXECUTION_ENTRY_SPEC.md',
      repoHref: `${REPO}/docs/EXECUTION_ENTRY_SPEC.md`,
    },
    {
      id: 'prover',
      layer: 'Prover',
      stepNum: 'Step 5',
      stepHref: '#5-set-what-your-proof-systems-check',
      what:
        prover === 'ecdsa'
          ? 'ECDSAProofSystem signer approves publicInputsHash for PoC bring-up; replace or raise threshold before real value.'
          : 'Enforce all 5 proof checks and bind chain IDs + EEZ address via deployment-specific vkey or getCustomData().',
      repoLabel: 'MULTI_PROVER_SPEC.md',
      repoHref: `${REPO}/docs/MULTI_PROVER_SPEC.md`,
    },
  ]

  if (stage === 's4') {
    rows.push({
      id: 'l2l2',
      layer: 'L2',
      stepNum: 'Step 4',
      stepHref: '#4-add-cross-chain-calls',
      addedBadge: 'In progress',
      what: 'Calls between two L2s: both chains must agree on the calls and their results, and approve the resulting state changes. Supported in the core contracts, in progress in the reference rollups.',
      repoLabel: 'CORE_PROTOCOL_SPEC.md',
      repoHref: `${REPO}/docs/CORE_PROTOCOL_SPEC.md`,
    })
  }

  const note =
    stage === 's4'
      ? 'L2↔L2 calls are in progress: eez-rollupX and eez-rollup0 support L2→L1 and L1→L2 today. Scope stages 1 to 3 now and add L2↔L2 when it lands.'
      : chain === 'existing' && prover === 'ecdsa'
      ? 'Existing L2 + ECDSA: pin initialRoot to your starting block hash, plan L1 reorg reconciliation, and govern Rollup / ProxyAdmin keys before production.'
      : chain === 'existing'
        ? 'Existing L2 + ZK: pin initialRoot to your starting block hash and bind chain IDs + EEZ address via vkey or getCustomData().'
        : prover === 'ecdsa'
          ? 'New rollup + ECDSA: fastest path to a working PoC; swap in production verifier(s) and govern Rollup / ProxyAdmin keys before holding value.'
          : 'New rollup + ZK: bind L1/L2 chain IDs and EEZ address via deployment-specific vkey or getCustomData() before launch.'

  const refRepo =
    base === 's3'
      ? { name: 'eez-rollupX', desc: 'nested, static & revert patterns', href: `${ORG}/eez-rollupX` }
      : { name: 'eez-rollup0', desc: 'baseline L2→L1 & L1→L2', href: `${ORG}/eez-rollup0` }

  const handleCopy = async () => {
    const stageLabel = stage === 's1' ? 'Stage 1 · Settlement' : stage === 's2' ? 'Stage 2 · L2→L1' : stage === 's3' ? 'Stage 3 · L1↔L2' : 'Stage 4 · L2↔L2 (in progress)'
    const chainLabel = chain === 'existing' ? 'Existing L2' : 'New rollup'
    const proverLabel = prover === 'ecdsa' ? 'ECDSA (PoC)' : 'ZK / Multi-prover'
    const md = [
      `## EEZ Integration Checklist (${chainLabel} · ${stageLabel} · ${proverLabel})`,
      '',
      ...rows.map((r) => `- [ ] **${r.layer} (${r.stepNum})**: ${r.what} ([${r.repoLabel}](${r.repoHref}))`),
      '',
      `> Note: ${note}`,
      `> Reference: [${refRepo.name}](${refRepo.href}) (${refRepo.desc})`,
    ].join(String.fromCharCode(10))

    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="eezi-shell" role="region" aria-label="Chain integration scoper">
      <div className="eezi-head">
        <span className="eezi-eyebrow">[ INTEGRATION SCOPER ]</span>
        <div className="eezi-head-actions">
          <button type="button" className={`eezi-ghost-btn ${copied ? 'is-copied' : ''}`} onClick={handleCopy}>
            <CopyIcon copied={copied} />
            <span>{copied ? 'Copied markdown' : 'Copy checklist'}</span>
          </button>
          <a className="eezi-link" href={`${REPO}/docs/CORE_PROTOCOL_SPEC.md`} target="_blank" rel="noreferrer">
            <span>eez-core-protocol</span>
            <ExternalIcon />
          </a>
        </div>
      </div>

      <div className="eezi-controls">
        <div className="eezi-control-col">
          <span className="eezi-control-label">Chain</span>
          <div className="eezi-seg eezi-seg--fill" role="group" aria-label="Chain type">
            <button type="button" className={`eezi-seg-btn ${chain === 'existing' ? 'is-active' : ''}`} aria-pressed={chain === 'existing'} onClick={() => setChain('existing')}>
              Existing L2
            </button>
            <button type="button" className={`eezi-seg-btn ${chain === 'new' ? 'is-active' : ''}`} aria-pressed={chain === 'new'} onClick={() => setChain('new')}>
              New rollup
            </button>
          </div>
        </div>

        <div className="eezi-control-col">
          <span className="eezi-control-label">Proof system</span>
          <div className="eezi-seg eezi-seg--fill" role="group" aria-label="Proof system">
            <button type="button" className={`eezi-seg-btn ${prover === 'ecdsa' ? 'is-active' : ''}`} aria-pressed={prover === 'ecdsa'} onClick={() => setProver('ecdsa')}>
              ECDSA (PoC)
            </button>
            <button type="button" className={`eezi-seg-btn ${prover === 'zk' ? 'is-active' : ''}`} aria-pressed={prover === 'zk'} onClick={() => setProver('zk')}>
              ZK / Multi
            </button>
          </div>
        </div>

        <div className="eezi-control-col eezi-control-col--wide">
          <span className="eezi-control-label">Target stage</span>
          <div className="eezi-seg eezi-seg--fill" role="group" aria-label="Stage">
            <button type="button" className={`eezi-seg-btn ${stage === 's1' ? 'is-active' : ''}`} aria-pressed={stage === 's1'} onClick={() => setStage('s1')}>
              1 · Settlement
            </button>
            <button type="button" className={`eezi-seg-btn ${stage === 's2' ? 'is-active' : ''}`} aria-pressed={stage === 's2'} onClick={() => setStage('s2')}>
              2 · L2→L1
            </button>
            <button type="button" className={`eezi-seg-btn ${stage === 's3' ? 'is-active' : ''}`} aria-pressed={stage === 's3'} onClick={() => setStage('s3')}>
              3 · L1↔L2
            </button>
            <button type="button" className={`eezi-seg-btn ${stage === 's4' ? 'is-active' : ''}`} aria-pressed={stage === 's4'} onClick={() => setStage('s4')}>
              4 · L2↔L2
            </button>
          </div>
        </div>
      </div>

      <div className="eezi-table" aria-live="polite">
        {rows.map((r) => (
          <div key={r.id} className="eezi-row">
            <div className="eezi-row-meta">
              <span className={`eezi-layer-badge eezi-layer-badge--${r.layer.toLowerCase().replace('-', '')}`}>{r.layer}</span>
              <a className="eezi-step-anchor" href={r.stepHref}>
                {r.stepNum}
              </a>
            </div>
            <div className="eezi-row-body">
              <span className="eezi-row-text">{r.what}</span>
              {r.addedBadge && <span className="eezi-delta-tag">{r.addedBadge}</span>}
            </div>
            <a className="eezi-link eezi-row-link" href={r.repoHref} target="_blank" rel="noreferrer">
              <span>{r.repoLabel}</span>
              <ExternalIcon />
            </a>
          </div>
        ))}
      </div>

      <div className="eezi-scoper-foot">
        <div className="eezi-callout eezi-callout--warn">
          <WarnIcon />
          <span>{note}</span>
        </div>
        <a className="eezi-ref-chip" href={refRepo.href} target="_blank" rel="noreferrer">
          <span className="eezi-ref-k">Reference</span>
          <span className="eezi-ref-v">{refRepo.name}</span>
          <span className="eezi-ref-d">· {refRepo.desc}</span>
          <ExternalIcon />
        </a>
      </div>
    </div>
  )
}
