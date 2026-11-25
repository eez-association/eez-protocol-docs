'use client'

import { useState } from 'react'

type Group = 'shared' | 'per-ps' | 'omitted'

interface Field {
  id: string
  label: string
  group: Group
  formula: string
  note: string
}

const REPO = 'https://github.com/eez-association/eez-core-protocol/blob/main'

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 2.25L14.25 13.25H1.75L8 2.25Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6.25V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
    </svg>
  )
}

const FIELDS: Field[] = [
  { id: 'entries', label: 'entries[]', group: 'shared', formula: 'keccak256(abi.encode(batch.entries[i]))', note: 'Binds every mutable ExecutionEntry struct (updates, proxyEntryHash, calls, rollingHash, returnData).' },
  { id: 'static', label: 'staticEntries[]', group: 'shared', formula: 'keccak256(abi.encode(batch.staticEntries[i]))', note: 'Binds every StaticExecutionEntry struct and its expectedRoots pins.' },
  { id: 'blobs', label: 'blobIndices[]', group: 'shared', formula: 'blobhash(batch.blobIndices[i])', note: 'Commits to exact EIP-4844 blobs in index order; missing blob reverts BlobNotFound.' },
  { id: 'calldata', label: 'callData', group: 'shared', formula: 'keccak256(batch.callData)', note: 'Commits to chain activity published in calldata.' },
  { id: 'custom', label: 'getCustomData()', group: 'shared', formula: 'keccak256(abi.encode(rollupId_r, customData_r))', note: 'Ordered by ascending rollupId. batch.blockNumber enters the hash only through this callback.' },
  { id: 'sender', label: 'bindMsgSender', group: 'shared', formula: 'bindMsgSenderInPublicInput ? msg.sender : address(0)', note: 'When true, binds the exact L1 caller allowed to submit the batch (front-run protection).' },
  { id: 'vkey', label: 'rollupId + vkey', group: 'per-ps', formula: 'keccak256(abi.encodePacked(sharedPublicInput, acc_k))', note: 'For each proof system k, folds (rollupId_r, vkey) in ascending rollupId order into acc_k before calling verify(proof[k], publicInputsHash[k]).' },
  { id: 'counts', label: 'immediateCounts', group: 'omitted', formula: 'Not hashed (guarded on-chain)', note: 'Submitter sets immediate vs. queued split without re-proving; EEZ still reverts if immediateEntryCount would strand an L2-origin (proxyEntryHash == 0) entry.' },
  { id: 'expected', label: 'expectedRootPerRollup', group: 'omitted', formula: 'Not hashed (checked first on-chain)', note: 'Optional batch-level precondition checked before verification; each entry’s currentRoot is still hashed inside entries[].' },
  { id: 'domain', label: 'chainId / EEZ addr', group: 'omitted', formula: 'Not hashed — bind manually', note: 'Proof public inputs omit L1/L2 chain IDs and the EEZ address. Bind your deployment via a unique vkey or getCustomData().' },
]

type BlockMode = 'zero' | 'max' | 'prev'

const BLOCK_MODES: Record<BlockMode, { label: string; code: string; hint: string }> = {
  zero: {
    label: '0',
    code: 'bytes("")',
    hint: 'No L1 block context attached.',
  },
  max: {
    label: 'uint64.max',
    code: 'abi.encode(block.timestamp, blockhash(block.number - 1))',
    hint: 'Latest L1 block timestamp + parent hash.',
  },
  prev: {
    label: 'prev block N',
    code: 'abi.encode(uint256(0), blockhash(N))',
    hint: 'Reverts BlockHashUnavailable if N is >256 blocks old.',
  },
}

const GROUP_BADGE: Record<Group, string> = {
  shared: 'STAGE 1 · SHARED',
  'per-ps': 'STAGE 2 · PER PROOF SYSTEM',
  omitted: 'OMITTED FROM HASH',
}

export function ProofHashExplorer() {
  const [selected, setSelected] = useState<string>('domain')
  const [blockMode, setBlockMode] = useState<BlockMode>('max')

  const field = FIELDS.find((f) => f.id === selected) ?? FIELDS[0]
  const sharedFields = FIELDS.filter((f) => f.group === 'shared')
  const perPsFields = FIELDS.filter((f) => f.group === 'per-ps')
  const omittedFields = FIELDS.filter((f) => f.group === 'omitted')

  return (
    <div className="eezi-shell" role="region" aria-label="publicInputsHash explorer">
      <div className="eezi-head">
        <span className="eezi-eyebrow">[ PUBLIC INPUTS HASH ]</span>
        <a className="eezi-link" href={`${REPO}/docs/MULTI_PROVER_SPEC.md#per-ps-publicinputshash-two-stage`} target="_blank" rel="noreferrer">
          <span>MULTI_PROVER_SPEC.md</span>
          <ExternalIcon />
        </a>
      </div>

      <div className="eezi-pipeline">
        <div className="eezi-stage-card">
          <div className="eezi-stage-head">
            <span className="eezi-stage-tag">Stage 1</span>
            <code className="eezi-stage-name">sharedPublicInput</code>
          </div>
          <div className="eezi-pill-group" role="group" aria-label="Stage 1 shared inputs">
            {sharedFields.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`eezi-pill ${selected === f.id ? 'is-active' : ''}`}
                aria-pressed={selected === f.id}
                onClick={() => setSelected(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="eezi-pipe-arrow" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 12H19M19 12L14 7M19 12L14 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="eezi-stage-card eezi-stage-card--s2">
          <div className="eezi-stage-head">
            <span className="eezi-stage-tag">Stage 2</span>
            <code className="eezi-stage-name">publicInputsHash[k]</code>
          </div>
          <div className="eezi-pill-group" role="group" aria-label="Stage 2 per proof system inputs">
            {perPsFields.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`eezi-pill ${selected === f.id ? 'is-active' : ''}`}
                aria-pressed={selected === f.id}
                onClick={() => setSelected(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="eezi-stage-out">→ verify(proof[k], hash[k])</div>
        </div>
      </div>

      <div className="eezi-omitted-tray">
        <div className="eezi-omitted-head">
          <WarnIcon />
          <span>Outside the hash — check or bind separately</span>
        </div>
        <div className="eezi-pill-group" role="group" aria-label="Omitted fields">
          {omittedFields.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`eezi-pill eezi-pill--warn ${selected === f.id ? 'is-active' : ''}`}
              aria-pressed={selected === f.id}
              onClick={() => setSelected(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`eezi-inspect ${field.group === 'omitted' ? 'is-warn' : ''}`} aria-live="polite">
        <div className="eezi-inspect-top">
          <span className={`eezi-inspect-badge eezi-inspect-badge--${field.group}`}>{GROUP_BADGE[field.group]}</span>
          <span className="eezi-inspect-field">{field.label}</span>
        </div>
        <code>{field.formula}</code>
        <p className="eezi-inspect-note">{field.note}</p>
      </div>

      <div className={`eezi-custom-box ${selected === 'custom' ? 'is-linked' : ''}`}>
        <div className="eezi-custom-bar">
          <button
            type="button"
            className="eezi-custom-title"
            onClick={() => setSelected('custom')}
          >
            Rollup.getCustomData(blockNumber)
          </button>
          <div className="eezi-seg" role="group" aria-label="getCustomData blockNumber mode">
            {(Object.keys(BLOCK_MODES) as BlockMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`eezi-seg-btn ${blockMode === m ? 'is-active' : ''}`}
                aria-pressed={blockMode === m}
                onClick={() => {
                  setBlockMode(m)
                  setSelected('custom')
                }}
              >
                {BLOCK_MODES[m].label}
              </button>
            ))}
          </div>
        </div>
        <div className="eezi-code-line">
          <code>{BLOCK_MODES[blockMode].code}</code>
          <span className="eezi-code-hint">{BLOCK_MODES[blockMode].hint}</span>
        </div>
      </div>
    </div>
  )
}
