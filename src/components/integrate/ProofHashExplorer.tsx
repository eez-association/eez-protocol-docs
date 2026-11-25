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

const FIELDS: Field[] = [
  { id: 'entries', label: 'entries[]', group: 'shared', formula: 'keccak256(abi.encode(entry))', note: 'Binds all mutable ExecutionEntry structs.' },
  { id: 'static', label: 'staticEntries[]', group: 'shared', formula: 'keccak256(abi.encode(staticEntry))', note: 'Binds all StaticExecutionEntry structs and expectedRoots.' },
  { id: 'blobs', label: 'blobIndices[]', group: 'shared', formula: 'blobhash(blobIndices[i])', note: 'Commits to exact EIP-4844 blobs in index order.' },
  { id: 'calldata', label: 'callData', group: 'shared', formula: 'keccak256(batch.callData)', note: 'Commits to chain activity published in calldata.' },
  { id: 'custom', label: 'getCustomData()', group: 'shared', formula: 'keccak256(abi.encode(rollupId, customData))', note: 'Ordered by ascending rollupId. batch.blockNumber enters only through this call.' },
  { id: 'sender', label: 'bindMsgSender', group: 'shared', formula: 'bind ? msg.sender : address(0)', note: 'Optionally restricts which L1 caller can submit the batch.' },
  { id: 'vkey', label: 'rollupId + vkey', group: 'per-ps', formula: 'keccak256(abi.encodePacked(shared, acc(rollupId, vkey)))', note: 'Folded per selected proof system k in ascending rollupId order.' },
  { id: 'counts', label: 'immediateCounts', group: 'omitted', formula: 'Not hashed (guarded on-chain)', note: 'Submitter sets immediate vs. queued split, but EEZ reverts if immediateEntryCount would strand an L2-origin (proxyEntryHash == 0) entry.' },
  { id: 'expected', label: 'expectedRootPerRollup', group: 'omitted', formula: 'Not hashed', note: 'Checked on-chain as a precondition; entry currentRoot is still bound in entries[].' },
  { id: 'domain', label: 'chainId / EEZ addr', group: 'omitted', formula: 'Not hashed — bind manually', note: 'Bind L1/L2 chain IDs and EEZ address via deployment-specific vkey or getCustomData().' },
]

type BlockMode = 'zero' | 'max' | 'prev'

const BLOCK_RETURNS: Record<BlockMode, [string, string]> = {
  zero: ['0', 'bytes("") — no L1 block context'],
  max: ['uint64.max', 'abi.encode(block.timestamp, blockhash(block.number - 1))'],
  prev: ['prev block N', 'abi.encode(uint256(0), blockhash(N))  // reverts if >256 blocks old'],
}

export function ProofHashExplorer() {
  const [selected, setSelected] = useState<string>('domain')
  const [blockMode, setBlockMode] = useState<BlockMode>('max')

  const field = FIELDS.find((f) => f.id === selected) ?? FIELDS[0]

  return (
    <div className="eezi-shell" role="region" aria-label="publicInputsHash explorer">
      <div className="eezi-head">
        <span className="eezi-eyebrow">[ PUBLIC INPUTS HASH ]</span>
        <a className="eezi-link" href={`${REPO}/docs/MULTI_PROVER_SPEC.md#per-ps-publicinputshash-two-stage`} target="_blank" rel="noreferrer">
          MULTI_PROVER_SPEC.md ↗
        </a>
      </div>

      <div className="eezi-hash-rows">
        {(['shared', 'per-ps', 'omitted'] as Group[]).map((g) => (
          <div key={g} className="eezi-hash-row">
            <span className={`eezi-hash-label eezi-hash-label--${g}`}>
              {g === 'shared' ? 'Shared' : g === 'per-ps' ? 'Per PS' : 'Omitted'}
            </span>
            <div className="eezi-pill-group">
              {FIELDS.filter((f) => f.group === g).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`eezi-pill ${g === 'omitted' ? 'eezi-pill--warn' : ''} ${selected === f.id ? 'is-active' : ''}`}
                  aria-pressed={selected === f.id}
                  onClick={() => setSelected(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={`eezi-inspect ${field.group === 'omitted' ? 'is-warn' : ''}`}>
        <code>{field.formula}</code>
        <span>{field.note}</span>
      </div>

      <div className="eezi-divider" />

      <div className="eezi-custom-bar">
        <span className="eezi-meta">Rollup.getCustomData(blockNumber):</span>
        <div className="eezi-pill-group" role="group" aria-label="getCustomData mode">
          {(Object.keys(BLOCK_RETURNS) as BlockMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`eezi-pill ${blockMode === m ? 'is-active' : ''}`}
              aria-pressed={blockMode === m}
              onClick={() => setBlockMode(m)}
            >
              {BLOCK_RETURNS[m][0]}
            </button>
          ))}
        </div>
      </div>
      <div className="eezi-code-line">{BLOCK_RETURNS[blockMode][1]}</div>
    </div>
  )
}
