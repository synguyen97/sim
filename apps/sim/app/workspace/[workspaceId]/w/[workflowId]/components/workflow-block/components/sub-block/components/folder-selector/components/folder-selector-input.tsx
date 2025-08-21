'use client'

import { useEffect, useState } from 'react'
import {
  type FolderInfo,
  FolderSelector,
} from '@/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/components/sub-block/components/folder-selector/folder-selector'
import { useDependsOnGate } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/components/sub-block/hooks/use-depends-on-gate'
import { useForeignCredential } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/components/sub-block/hooks/use-foreign-credential'
import { useSubBlockValue } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/components/sub-block/hooks/use-sub-block-value'
import type { SubBlockConfig } from '@/blocks/types'
import { useCollaborativeWorkflow } from '@/hooks/use-collaborative-workflow'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'

interface FolderSelectorInputProps {
  blockId: string
  subBlock: SubBlockConfig
  disabled?: boolean
  isPreview?: boolean
  previewValue?: any | null
}

export function FolderSelectorInput({
  blockId,
  subBlock,
  disabled = false,
  isPreview = false,
  previewValue,
}: FolderSelectorInputProps) {
  const [storeValue, _setStoreValue] = useSubBlockValue(blockId, subBlock.id)
  const [connectedCredential] = useSubBlockValue(blockId, 'credential')
  const { collaborativeSetSubblockValue } = useCollaborativeWorkflow()
  const { activeWorkflowId } = useWorkflowRegistry()
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [_folderInfo, setFolderInfo] = useState<FolderInfo | null>(null)
  const { isForeignCredential } = useForeignCredential(
    subBlock.provider || subBlock.serviceId || 'outlook',
    (connectedCredential as string) || ''
  )

  // Central dependsOn gating
  const { finalDisabled } = useDependsOnGate(blockId, subBlock, { disabled, isPreview })

  // Get the current value from the store or prop value if in preview mode
  useEffect(() => {
    // When gated/disabled, do not set defaults or write to store
    if (finalDisabled) return
    if (isPreview && previewValue !== undefined) {
      setSelectedFolderId(previewValue)
      return
    }
    const current = storeValue as string | undefined
    if (current && typeof current === 'string') {
      setSelectedFolderId(current)
      return
    }
    // Set default INBOX if empty
    const defaultValue = 'INBOX'
    setSelectedFolderId(defaultValue)
    if (!isPreview) {
      collaborativeSetSubblockValue(blockId, subBlock.id, defaultValue)
    }
  }, [
    blockId,
    subBlock.id,
    storeValue,
    collaborativeSetSubblockValue,
    isPreview,
    previewValue,
    finalDisabled,
  ])

  // Handle folder selection
  const handleFolderChange = (folderId: string, info?: FolderInfo) => {
    setSelectedFolderId(folderId)
    setFolderInfo(info || null)
    if (!isPreview) {
      collaborativeSetSubblockValue(blockId, subBlock.id, folderId)
    }
  }

  return (
    <FolderSelector
      value={selectedFolderId}
      onChange={handleFolderChange}
      provider={subBlock.provider || 'google-email'}
      requiredScopes={subBlock.requiredScopes || []}
      label={subBlock.placeholder || 'Select folder'}
      disabled={finalDisabled}
      serviceId={subBlock.serviceId}
      onFolderInfoChange={setFolderInfo}
      credentialId={(connectedCredential as string) || ''}
      workflowId={activeWorkflowId || ''}
      isForeignCredential={isForeignCredential}
    />
  )
}
