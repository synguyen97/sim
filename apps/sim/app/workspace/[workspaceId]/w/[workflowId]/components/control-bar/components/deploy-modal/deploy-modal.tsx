'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { getEnv } from '@/lib/env'
import { createLogger } from '@/lib/logs/console/logger'
import { cn } from '@/lib/utils'
import {
  DeployForm,
  DeploymentInfo,
} from '@/app/workspace/[workspaceId]/w/[workflowId]/components/control-bar/components/deploy-modal/components'
import { ChatDeploy } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/control-bar/components/deploy-modal/components/chat-deploy/chat-deploy'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import type { WorkflowState } from '@/stores/workflows/workflow/types'

const logger = createLogger('DeployModal')

interface DeployModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string | null
  needsRedeployment: boolean
  setNeedsRedeployment: (value: boolean) => void
  deployedState: WorkflowState
  isLoadingDeployedState: boolean
  refetchDeployedState: () => Promise<void>
}

interface ApiKey {
  id: string
  name: string
  key: string
  lastUsed?: string
  createdAt: string
  expiresAt?: string
}

interface WorkflowDeploymentInfo {
  isDeployed: boolean
  deployedAt?: string
  apiKey: string
  endpoint: string
  exampleCommand: string
  needsRedeployment: boolean
}

interface DeployFormValues {
  apiKey: string
  newKeyName?: string
}

type TabView = 'api' | 'chat'

export function DeployModal({
  open,
  onOpenChange,
  workflowId,
  needsRedeployment,
  setNeedsRedeployment,
  deployedState,
  isLoadingDeployedState,
  refetchDeployedState,
}: DeployModalProps) {
  const deploymentStatus = useWorkflowRegistry((state) =>
    state.getWorkflowDeploymentStatus(workflowId)
  )
  const isDeployed = deploymentStatus?.isDeployed || false
  const setDeploymentStatus = useWorkflowRegistry((state) => state.setDeploymentStatus)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUndeploying, setIsUndeploying] = useState(false)
  const [deploymentInfo, setDeploymentInfo] = useState<WorkflowDeploymentInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [keysLoaded, setKeysLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<TabView>('api')
  const [chatSubmitting, setChatSubmitting] = useState(false)
  const [apiDeployError, setApiDeployError] = useState<string | null>(null)
  const [chatExists, setChatExists] = useState(false)
  const [isChatFormValid, setIsChatFormValid] = useState(false)

  const getInputFormatExample = () => {
    let inputFormatExample = ''
    try {
      const blocks = Object.values(useWorkflowStore.getState().blocks)
      const starterBlock = blocks.find((block) => block.type === 'starter')

      if (starterBlock) {
        const inputFormat = useSubBlockStore.getState().getValue(starterBlock.id, 'inputFormat')

        if (inputFormat && Array.isArray(inputFormat) && inputFormat.length > 0) {
          const exampleData: Record<string, any> = {}
          inputFormat.forEach((field: any) => {
            if (field.name) {
              switch (field.type) {
                case 'string':
                  exampleData[field.name] = 'example'
                  break
                case 'number':
                  exampleData[field.name] = 42
                  break
                case 'boolean':
                  exampleData[field.name] = true
                  break
                case 'object':
                  exampleData[field.name] = { key: 'value' }
                  break
                case 'array':
                  exampleData[field.name] = [1, 2, 3]
                  break
              }
            }
          })

          inputFormatExample = ` -d '${JSON.stringify(exampleData)}'`
        }
      }
    } catch (error) {
      logger.error('Error generating input format example:', error)
    }

    return inputFormatExample
  }

  const fetchApiKeys = async () => {
    if (!open) return

    try {
      setKeysLoaded(false)
      const response = await fetch('/api/users/me/api-keys')

      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.keys || [])
        setKeysLoaded(true)
      }
    } catch (error) {
      logger.error('Error fetching API keys:', { error })
      setKeysLoaded(true)
    }
  }

  const fetchChatDeploymentInfo = async () => {
    if (!open || !workflowId) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/workflows/${workflowId}/chat/status`)

      if (response.ok) {
        const data = await response.json()
        if (data.isDeployed && data.deployment) {
          setChatExists(true)
        } else {
          setChatExists(false)
        }
      } else {
        setChatExists(false)
      }
    } catch (error) {
      logger.error('Error fetching chat deployment info:', { error })
      setChatExists(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setIsLoading(true)
      fetchApiKeys()
      fetchChatDeploymentInfo()
      setActiveTab('api')
    }
  }, [open, workflowId])

  useEffect(() => {
    async function fetchDeploymentInfo() {
      // If not open or not deployed, clear info and stop
      if (!open || !workflowId || !isDeployed) {
        setDeploymentInfo(null)
        if (!open) {
          setIsLoading(false)
        }
        return
      }

      // If we already have deploymentInfo (e.g., just deployed and set locally), avoid overriding it
      if (deploymentInfo?.isDeployed && !needsRedeployment) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)

        const response = await fetch(`/api/workflows/${workflowId}/deploy`)

        if (!response.ok) {
          throw new Error('Failed to fetch deployment information')
        }

        const data = await response.json()
        const endpoint = `${getEnv('NEXT_PUBLIC_APP_URL')}/api/workflows/${workflowId}/execute`
        const inputFormatExample = getInputFormatExample()

        setDeploymentInfo({
          isDeployed: data.isDeployed,
          deployedAt: data.deployedAt,
          apiKey: data.apiKey,
          endpoint,
          exampleCommand: `curl -X POST -H "X-API-Key: ${data.apiKey}" -H "Content-Type: application/json"${inputFormatExample} ${endpoint}`,
          needsRedeployment,
        })
      } catch (error) {
        logger.error('Error fetching deployment info:', { error })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDeploymentInfo()
  }, [open, workflowId, isDeployed, needsRedeployment, deploymentInfo?.isDeployed])

  const onDeploy = async (data: DeployFormValues) => {
    setApiDeployError(null)

    try {
      setIsSubmitting(true)

      const response = await fetch(`/api/workflows/${workflowId}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: data.apiKey,
          deployChatEnabled: false,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to deploy workflow')
      }

      const { isDeployed: newDeployStatus, deployedAt, apiKey } = await response.json()

      setDeploymentStatus(
        workflowId,
        newDeployStatus,
        deployedAt ? new Date(deployedAt) : undefined,
        apiKey || data.apiKey
      )

      setNeedsRedeployment(false)
      if (workflowId) {
        useWorkflowRegistry.getState().setWorkflowNeedsRedeployment(workflowId, false)
      }
      const endpoint = `${getEnv('NEXT_PUBLIC_APP_URL')}/api/workflows/${workflowId}/execute`
      const inputFormatExample = getInputFormatExample()

      const newDeploymentInfo = {
        isDeployed: true,
        deployedAt: deployedAt,
        apiKey: apiKey || data.apiKey,
        endpoint,
        exampleCommand: `curl -X POST -H "X-API-Key: ${apiKey || data.apiKey}" -H "Content-Type: application/json"${inputFormatExample} ${endpoint}`,
        needsRedeployment: false,
      }

      setDeploymentInfo(newDeploymentInfo)

      await refetchDeployedState()
    } catch (error: any) {
      logger.error('Error deploying workflow:', { error })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUndeploy = async () => {
    try {
      setIsUndeploying(true)

      const response = await fetch(`/api/workflows/${workflowId}/deploy`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to undeploy workflow')
      }

      setDeploymentStatus(workflowId, false)
      setChatExists(false)
      onOpenChange(false)
    } catch (error: any) {
      logger.error('Error undeploying workflow:', { error })
    } finally {
      setIsUndeploying(false)
    }
  }

  const handleRedeploy = async () => {
    try {
      setIsSubmitting(true)

      const response = await fetch(`/api/workflows/${workflowId}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deployChatEnabled: false,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to redeploy workflow')
      }

      const { isDeployed: newDeployStatus, deployedAt, apiKey } = await response.json()

      setDeploymentStatus(
        workflowId,
        newDeployStatus,
        deployedAt ? new Date(deployedAt) : undefined,
        apiKey
      )

      setNeedsRedeployment(false)
      if (workflowId) {
        useWorkflowRegistry.getState().setWorkflowNeedsRedeployment(workflowId, false)
      }

      await refetchDeployedState()

      // Ensure modal status updates immediately
      setDeploymentInfo((prev) => (prev ? { ...prev, needsRedeployment: false } : prev))
    } catch (error: any) {
      logger.error('Error redeploying workflow:', { error })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseModal = () => {
    setIsSubmitting(false)
    setChatSubmitting(false)
    onOpenChange(false)
  }

  const handleWorkflowPreDeploy = async () => {
    if (!isDeployed) {
      const response = await fetch(`/api/workflows/${workflowId}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deployApiEnabled: true,
          deployChatEnabled: false,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to deploy workflow')
      }

      const { isDeployed: newDeployStatus, deployedAt, apiKey } = await response.json()

      setDeploymentStatus(
        workflowId,
        newDeployStatus,
        deployedAt ? new Date(deployedAt) : undefined,
        apiKey
      )

      setDeploymentInfo((prev) => (prev ? { ...prev, apiKey } : null))
    }
  }

  const handleChatFormSubmit = () => {
    const form = document.getElementById('chat-deploy-form') as HTMLFormElement
    if (form) {
      // Check if we're in success view and need to trigger update
      const updateTrigger = form.querySelector('[data-update-trigger]') as HTMLButtonElement
      if (updateTrigger) {
        updateTrigger.click()
      } else {
        form.requestSubmit()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleCloseModal}>
      <DialogContent
        className='flex max-h-[78vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]'
        hideCloseButton
      >
        <DialogHeader className='flex-shrink-0 border-b px-6 py-4'>
          <div className='flex items-center justify-between'>
            <DialogTitle className='font-medium text-lg'>Deploy Workflow</DialogTitle>
            <Button variant='ghost' size='icon' className='h-8 w-8 p-0' onClick={handleCloseModal}>
              <X className='h-4 w-4' />
              <span className='sr-only'>Close</span>
            </Button>
          </div>
        </DialogHeader>

        <div className='flex flex-1 flex-col overflow-hidden'>
          <div className='flex h-14 flex-none items-center border-b px-6'>
            <div className='flex gap-2'>
              <button
                onClick={() => setActiveTab('api')}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${
                  activeTab === 'api'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                API
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                Chat
              </button>
            </div>
          </div>

          <div className='flex-1 overflow-y-auto'>
            <div className='p-6'>
              {activeTab === 'api' && (
                <>
                  {isDeployed ? (
                    <DeploymentInfo
                      isLoading={isLoading}
                      deploymentInfo={
                        deploymentInfo ? { ...deploymentInfo, needsRedeployment } : null
                      }
                      onRedeploy={handleRedeploy}
                      onUndeploy={handleUndeploy}
                      isSubmitting={isSubmitting}
                      isUndeploying={isUndeploying}
                      workflowId={workflowId}
                      deployedState={deployedState}
                      isLoadingDeployedState={isLoadingDeployedState}
                      getInputFormatExample={getInputFormatExample}
                    />
                  ) : (
                    <>
                      {apiDeployError && (
                        <div className='mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm'>
                          <div className='font-semibold'>API Deployment Error</div>
                          <div>{apiDeployError}</div>
                        </div>
                      )}
                      <div className='-mx-1 px-1'>
                        <DeployForm
                          apiKeys={apiKeys}
                          keysLoaded={keysLoaded}
                          endpointUrl={`${getEnv('NEXT_PUBLIC_APP_URL')}/api/workflows/${workflowId}/execute`}
                          workflowId={workflowId || ''}
                          onSubmit={onDeploy}
                          getInputFormatExample={getInputFormatExample}
                          onApiKeyCreated={fetchApiKeys}
                          formId='deploy-api-form'
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'chat' && (
                <ChatDeploy
                  workflowId={workflowId || ''}
                  deploymentInfo={deploymentInfo}
                  onChatExistsChange={setChatExists}
                  chatSubmitting={chatSubmitting}
                  setChatSubmitting={setChatSubmitting}
                  onValidationChange={setIsChatFormValid}
                  onPreDeployWorkflow={handleWorkflowPreDeploy}
                  onDeploymentComplete={handleCloseModal}
                />
              )}
            </div>
          </div>
        </div>

        {activeTab === 'api' && !isDeployed && (
          <div className='flex flex-shrink-0 justify-between border-t px-6 py-4'>
            <Button variant='outline' onClick={handleCloseModal}>
              Cancel
            </Button>

            <Button
              type='submit'
              form='deploy-api-form'
              disabled={isSubmitting || (!keysLoaded && !apiKeys.length)}
              className={cn(
                'gap-2 font-medium',
                'bg-[#65a8a4] hover:bg-[#7028E6]',
                'shadow-[0_0_0_0_#65a8a4] hover:shadow-[0_0_0_4px_rgba(127,47,255,0.15)]',
                'text-white transition-all duration-200',
                'disabled:opacity-50 disabled:hover:bg-[#65a8a4] disabled:hover:shadow-none'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                  Deploying...
                </>
              ) : (
                'Deploy API'
              )}
            </Button>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className='flex flex-shrink-0 justify-between border-t px-6 py-4'>
            <Button variant='outline' onClick={handleCloseModal}>
              Cancel
            </Button>

            <div className='flex gap-2'>
              {chatExists && (
                <Button
                  type='button'
                  onClick={() => {
                    const form = document.getElementById('chat-deploy-form') as HTMLFormElement
                    if (form) {
                      const deleteButton = form.querySelector(
                        '[data-delete-trigger]'
                      ) as HTMLButtonElement
                      if (deleteButton) {
                        deleteButton.click()
                      }
                    }
                  }}
                  disabled={chatSubmitting}
                  className={cn(
                    'gap-2 font-medium',
                    'bg-red-500 hover:bg-red-600',
                    'shadow-[0_0_0_0_rgb(239,68,68)] hover:shadow-[0_0_0_4px_rgba(239,68,68,0.15)]',
                    'text-white transition-all duration-200',
                    'disabled:opacity-50 disabled:hover:bg-red-500 disabled:hover:shadow-none'
                  )}
                >
                  Delete
                </Button>
              )}
              <Button
                type='button'
                onClick={handleChatFormSubmit}
                disabled={chatSubmitting || !isChatFormValid}
                className={cn(
                  'gap-2 font-medium',
                  'bg-[#65a8a4] hover:bg-[#7028E6]',
                  'shadow-[0_0_0_0_#65a8a4] hover:shadow-[0_0_0_4px_rgba(127,47,255,0.15)]',
                  'text-white transition-all duration-200',
                  'disabled:opacity-50 disabled:hover:bg-[#65a8a4] disabled:hover:shadow-none'
                )}
              >
                {chatSubmitting ? (
                  <>
                    <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                    Deploying...
                  </>
                ) : chatExists ? (
                  'Update'
                ) : (
                  'Deploy Chat'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
