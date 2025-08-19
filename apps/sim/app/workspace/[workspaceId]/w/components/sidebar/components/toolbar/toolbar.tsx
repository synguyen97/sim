'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToolbarBlock } from '@/app/workspace/[workspaceId]/w/components/sidebar/components/toolbar/components/toolbar-block/toolbar-block'
import LoopToolbarItem from '@/app/workspace/[workspaceId]/w/components/sidebar/components/toolbar/components/toolbar-loop-block/toolbar-loop-block'
import ParallelToolbarItem from '@/app/workspace/[workspaceId]/w/components/sidebar/components/toolbar/components/toolbar-parallel-block/toolbar-parallel-block'
import { getAllBlocks } from '@/blocks'
import type { WorkspaceUserPermissions } from '@/hooks/use-user-permissions'
import { Hr } from '@react-email/components'

interface ToolbarProps {
  userPermissions: WorkspaceUserPermissions
  isWorkspaceSelectorVisible?: boolean
}

interface BlockItem {
  name: string
  type: string
  isCustom: boolean
  config?: any
}

export function Toolbar({ userPermissions, isWorkspaceSelectorVisible = false }: ToolbarProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Blocks to show only in specialBlocks, tools, and triggers sections
  const priorityBlockNames = [
    'Google Calendar',
    'Google Docs', 
    'Google Drive',
    'Google Search',
    'Google Sheets',
    'Gmail',
    'Slack',
    'Notion',
    'Confluence',
    'Discord',
    'ElevenLabs',
    'GitHub',
    'Linear',
    'Hugging Face',
    'Jira',
    // 'Microsoft Excel',
    // 'Microsoft Planner',
    // 'Microsoft Teams',
    'Reddit',
    'Telegram',
    'Twilio SMS',
    'Typeform',
    'WhatsApp',
    'Wikipedia',
    'X',
    'Youtube',
    'Schedule',
    'Webhook',
    'Serper',
    'Memory',
    'Parallel',
  ]

  const { regularBlocks, specialBlocks, tools, triggers } = useMemo(() => {
    const allBlocks = getAllBlocks()

    // Filter blocks based on search query
    const filteredBlocks = allBlocks.filter((block) => {
      if (block.type === 'starter' || block.hideFromToolbar) return false

      return (
        !searchQuery.trim() ||
        block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        block.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })

    // Separate blocks by category: 'blocks', 'tools', and 'triggers'
    const regularBlockConfigs = filteredBlocks.filter((block) => 
      block.category === 'blocks' && !priorityBlockNames.includes(block.name)
    )
    
    const toolConfigs = filteredBlocks.filter((block) => 
      block.category === 'tools' && priorityBlockNames.includes(block.name)
    )
    
    const triggerConfigs = filteredBlocks.filter((block) => 
      block.category === 'triggers' && priorityBlockNames.includes(block.name)
    )

    // Create regular block items and sort alphabetically
    const regularBlockItems: BlockItem[] = regularBlockConfigs
      .map((block) => ({
        name: block.name,
        type: block.type,
        config: block,
        isCustom: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Create special blocks (loop, parallel, and priority blocks)
    const specialBlockItems: BlockItem[] = []

    // Add Loop and Parallel if they match search
    if (!searchQuery.trim() || 'loop'.toLowerCase().includes(searchQuery.toLowerCase())) {
      specialBlockItems.push({
        name: 'Loop',
        type: 'loop',
        isCustom: true,
      })
    }

    if (!searchQuery.trim() || 'parallel'.toLowerCase().includes(searchQuery.toLowerCase())) {
      specialBlockItems.push({
        name: 'Parallel',
        type: 'parallel',
        isCustom: true,
      })
    }

    // Add priority blocks that are in 'blocks' category to special blocks
    const prioritySpecialBlocks = filteredBlocks.filter((block) => 
      block.category === 'blocks' && priorityBlockNames.includes(block.name)
    )

    prioritySpecialBlocks.forEach((block) => {
      specialBlockItems.push({
        name: block.name,
        type: block.type,
        config: block,
        isCustom: false,
      })
    })

    // Sort special blocks alphabetically
    specialBlockItems.sort((a, b) => a.name.localeCompare(b.name))

    // Create trigger block items and sort alphabetically
    const triggerBlockItems: BlockItem[] = triggerConfigs
      .map((block) => ({
        name: block.name,
        type: block.type,
        config: block,
        isCustom: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Sort tools alphabetically
    toolConfigs.sort((a, b) => a.name.localeCompare(b.name))

    return {
      regularBlocks: regularBlockItems,
      specialBlocks: specialBlockItems,
      tools: toolConfigs,
      triggers: triggerBlockItems,
    }
  }, [searchQuery])
  
  return (
    <div className='flex h-full flex-col'>
      {/* Search */}
      <div className='flex-shrink-0 p-2'>
        <div className='flex h-9 items-center gap-2 rounded-[8px] border bg-background pr-2 pl-3'>
          <Search className='h-4 w-4 text-muted-foreground' strokeWidth={2} />
          <Input
            placeholder='Search nuggets...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='h-6 flex-1 border-0 bg-transparent px-0 text-muted-foreground text-sm leading-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0'
            autoComplete='off'
            autoCorrect='off'
            autoCapitalize='off'
            spellCheck='false'
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className='flex-1 px-2 pb-[0.26px]' hideScrollbar={true}>
        <div className='space-y-1 pb-2'>
          {/* Regular Blocks Section */}
          {regularBlocks.map((block) => (
            <ToolbarBlock
              key={block.type}
              config={block.config}
              disabled={!userPermissions.canEdit}
            />
          ))}

          {/* Special Blocks Section (Loop & Parallel) */}
          {specialBlocks.filter(item => item.type !== 'parallel').map((block) => {
            if (block.type === 'loop') {
              return <LoopToolbarItem key={block.type} disabled={!userPermissions.canEdit} />
            }
            if (block.type === 'parallel') {
              return <ParallelToolbarItem key={block.type} disabled={!userPermissions.canEdit} />
            }
            return null
          })}

          {/* Triggers Section */}
          {triggers.map((trigger) => (
            <ToolbarBlock
              key={trigger.type}
              config={trigger.config}
              disabled={!userPermissions.canEdit}
            />
          ))}

          <Hr></Hr>
          <div className='text-xs text-muted-foreground'>Tools</div>
          {/* Tools Section */}
          {tools.map((tool) => (
            <ToolbarBlock key={tool.type} config={tool} disabled={!userPermissions.canEdit} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
