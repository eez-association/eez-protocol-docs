'use client'

import { useState } from 'react'

type ChainType = 'existing' | 'new'
type Stage = 's1' | 's2' | 's3'
type ProverMode = 'ecdsa' | 'zk'

interface Row {
  layer: 'L1' | 'L2' | 'Off-chain'
  what: string
  repoLabel: string
  repoHref: string
}

const REPO = 'https://github.com/eez-association/eez-core-protocol/blob/main'

export function IntegrationConfigurator() {
  const [chain, setChain] = useState<ChainType>('existing')
  const [stage, setStage] = useState<Stage>('s2')
  const [prover, setProver] = useState<ProverMode>('ecdsa')

  const rows: Row[] = [
    {
      layer: 'L1',
      what:
        prover === 'ecdsa'
          ? 'Deploy ECDSAProofSystem + Rollup (per-rollup threshold; may be 0) + EEZ.registerRollup'
          : 'Deploy verifier(s) + Rollup (vkeys, per-rollup threshold; may be 0) + EEZ.registerRollup',
      repoLabel: 'deployment/README.md',
      repoHref: `${REPO}/deployment/README.md#individual-deployments`,
    },
    {
      layer: 'L1',
      what:
        stage === 's1'
          ? 'Post root-only batches via EEZ.postAndVerifyBatch'
          : stage === 's2'
            ? 'Post L2→L1 entries via EEZ.postAndVerifyBatch'
            : 'Same-block ordering: builder bundle or IMetaCrossChainReceiver',
      repoLabel: 'src/EEZ.sol',
      repoHref: `${REPO}/src/EEZ.sol`,
    },
    {
      layer: 'L2',
      what:
        stage === 's1'
          ? 'Follow executed L1 updates & L1 reorgs'
          : stage === 's2'
            ? 'Deploy EEZL2 + protected system caller (loadExecutionTable)'
            : 'EEZL2 + loadExecutionTable + executeIncomingCrossChainCall + ETH funding',
      repoLabel: 'src/L2/EEZL2.sol',
      repoHref: `${REPO}/src/L2/EEZL2.sol`,
    },
    {
      layer: 'Off-chain',
      what:
        stage === 's1'
          ? 'Publish DA (EEZ blob format or custom) + batch poster + proof system(s)'
          : 'Composer (simulate + build entries) + DA publisher + same-block proving',
      repoLabel: 'docs/EXECUTION_ENTRY_SPEC.md',
      repoHref: `${REPO}/docs/EXECUTION_ENTRY_SPEC.md`,
    },
  ]

  const note =
    chain === 'existing' && prover === 'ecdsa'
      ? 'Existing L2: set initialRoot to your starting block hash and plan L1 reorg handling. ECDSA is for PoC only.'
      : chain === 'existing'
        ? 'Existing L2: set initialRoot to your starting block hash and reconcile EEZ updates with your existing finality/reorg path.'
        : prover === 'ecdsa'
          ? 'ECDSAProofSystem is ideal for fast PoC bring-up; replace or raise threshold before holding real value.'
          : 'Bind chain IDs and EEZ address via deployment-specific vkey or getCustomData().'

  return (
    <div className="eezi-shell" role="region" aria-label="Chain integration scoper">
      <div className="eezi-head">
        <span className="eezi-eyebrow">[ INTEGRATION SCOPER ]</span>
        <a className="eezi-link" href={`${REPO}/docs/CORE_PROTOCOL_SPEC.md`} target="_blank" rel="noreferrer">
          eez-core-protocol ↗
        </a>
      </div>

      <div className="eezi-bar">
        <div className="eezi-pill-group" role="group" aria-label="Chain type">
          <button type="button" className={`eezi-pill ${chain === 'existing' ? 'is-active' : ''}`} aria-pressed={chain === 'existing'} onClick={() => setChain('existing')}>
            Existing L2
          </button>
          <button type="button" className={`eezi-pill ${chain === 'new' ? 'is-active' : ''}`} aria-pressed={chain === 'new'} onClick={() => setChain('new')}>
            New rollup
          </button>
        </div>

        <div className="eezi-pill-group" role="group" aria-label="Stage">
          <button type="button" className={`eezi-pill ${stage === 's1' ? 'is-active' : ''}`} aria-pressed={stage === 's1'} onClick={() => setStage('s1')}>
            1 · Settlement
          </button>
          <button type="button" className={`eezi-pill ${stage === 's2' ? 'is-active' : ''}`} aria-pressed={stage === 's2'} onClick={() => setStage('s2')}>
            2 · L2→L1
          </button>
          <button type="button" className={`eezi-pill ${stage === 's3' ? 'is-active' : ''}`} aria-pressed={stage === 's3'} onClick={() => setStage('s3')}>
            3 · L1↔L2
          </button>
        </div>

        <div className="eezi-pill-group" role="group" aria-label="Proof system">
          <button type="button" className={`eezi-pill ${prover === 'ecdsa' ? 'is-active' : ''}`} aria-pressed={prover === 'ecdsa'} onClick={() => setProver('ecdsa')}>
            ECDSA (PoC)
          </button>
          <button type="button" className={`eezi-pill ${prover === 'zk' ? 'is-active' : ''}`} aria-pressed={prover === 'zk'} onClick={() => setProver('zk')}>
            ZK / Multi-prover
          </button>
        </div>
      </div>

      <div className="eezi-table">
        {rows.map((r) => (
          <div key={r.what} className="eezi-row">
            <span className="eezi-row-tag">{r.layer}</span>
            <span className="eezi-row-text">{r.what}</span>
            <a className="eezi-link" href={r.repoHref} target="_blank" rel="noreferrer">
              {r.repoLabel} ↗
            </a>
          </div>
        ))}
      </div>

      <div className="eezi-note-line">{note}</div>
    </div>
  )
}
