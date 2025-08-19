import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { useSession } from '@/lib/auth-client'
import { checkEnterprisePlan } from '@/lib/billing/subscriptions/utils'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logs/console/logger'
import { generateSlug, useOrganizationStore } from '@/stores/organization'
import { useSubscriptionStore } from '@/stores/subscription/store'
import {
  MemberInvitationCard,
  NoOrganizationView,
  OrganizationSettingsTab,
  PendingInvitationsList,
  RemoveMemberDialog,
  TeamMembersList,
  TeamSeats,
  TeamSeatsOverview,
  TeamUsage,
} from './components'

const logger = createLogger('TeamManagement')

export function TeamManagement() {
  const { data: session } = useSession()

  const {
    organizations,
    activeOrganization,
    subscriptionData,
    userWorkspaces,
    orgFormData,
    hasTeamPlan,
    hasEnterprisePlan,
    isLoading,
    isLoadingSubscription,
    isCreatingOrg,
    isInviting,
    isSavingOrgSettings,
    error,
    orgSettingsError,
    inviteSuccess,
    orgSettingsSuccess,
    loadData,
    createOrganization,
    setActiveOrganization,
    inviteMember,
    removeMember,
    cancelInvitation,
    addSeats,
    reduceSeats,
    updateOrganizationSettings,
    loadUserWorkspaces,
    getUserRole,
    isAdminOrOwner,
    getUsedSeats,
    setOrgFormData,
  } = useOrganizationStore()

  const { getSubscriptionStatus } = useSubscriptionStore()

  const [inviteEmail, setInviteEmail] = useState('')
  const [showWorkspaceInvite, setShowWorkspaceInvite] = useState(false)
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<
    Array<{ workspaceId: string; permission: string }>
  >([])
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false)
  const [removeMemberDialog, setRemoveMemberDialog] = useState<{
    open: boolean
    memberId: string
    memberName: string
    shouldReduceSeats: boolean
  }>({ open: false, memberId: '', memberName: '', shouldReduceSeats: false })
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [activeTab, setActiveTab] = useState('members')
  const [isAddSeatDialogOpen, setIsAddSeatDialogOpen] = useState(false)
  const [newSeatCount, setNewSeatCount] = useState(1)
  const [isUpdatingSeats, setIsUpdatingSeats] = useState(false)

  const userRole = getUserRole(session?.user?.email)
  const adminOrOwner = isAdminOrOwner(session?.user?.email)
  const usedSeats = getUsedSeats()
  const subscription = getSubscriptionStatus()

  const hasLoadedInitialData = useRef(false)
  useEffect(() => {
    if (!hasLoadedInitialData.current) {
      loadData()
      hasLoadedInitialData.current = true
    }
  }, [])

  // Set default organization name for team/enterprise users
  useEffect(() => {
    if ((hasTeamPlan || hasEnterprisePlan) && session?.user?.name && !orgName) {
      const defaultName = `${session.user.name}'s Team`
      setOrgName(defaultName)
      setOrgSlug(generateSlug(defaultName))
    }
  }, [hasTeamPlan, hasEnterprisePlan, session?.user?.name, orgName])

  // Load workspaces for admin users
  const activeOrgId = activeOrganization?.id
  useEffect(() => {
    if (session?.user?.id && activeOrgId && adminOrOwner) {
      loadUserWorkspaces(session.user.id)
    }
  }, [session?.user?.id, activeOrgId, adminOrOwner])

  const handleOrgNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setOrgName(newName)
    setOrgSlug(generateSlug(newName))
  }, [])

  const handleCreateOrganization = useCallback(async () => {
    if (!session?.user || !orgName.trim()) return
    await createOrganization(orgName.trim(), orgSlug.trim())
    setCreateOrgDialogOpen(false)
    setOrgName('')
    setOrgSlug('')
  }, [session?.user?.id, orgName, orgSlug])

  const handleInviteMember = useCallback(async () => {
    if (!session?.user || !activeOrgId || !inviteEmail.trim()) return

    await inviteMember(
      inviteEmail.trim(),
      selectedWorkspaces.length > 0 ? selectedWorkspaces : undefined
    )

    setInviteEmail('')
    setSelectedWorkspaces([])
    setShowWorkspaceInvite(false)
  }, [session?.user?.id, activeOrgId, inviteEmail, selectedWorkspaces])

  const handleWorkspaceToggle = useCallback((workspaceId: string, permission: string) => {
    setSelectedWorkspaces((prev) => {
      const exists = prev.find((w) => w.workspaceId === workspaceId)

      if (!permission || permission === '') {
        return prev.filter((w) => w.workspaceId !== workspaceId)
      }

      if (exists) {
        return prev.map((w) => (w.workspaceId === workspaceId ? { ...w, permission } : w))
      }

      return [...prev, { workspaceId, permission }]
    })
  }, [])

  const handleRemoveMember = useCallback(
    async (member: any) => {
      if (!session?.user || !activeOrgId) return

      setRemoveMemberDialog({
        open: true,
        memberId: member.id,
        memberName: member.user?.name || member.user?.email || 'this member',
        shouldReduceSeats: false,
      })
    },
    [session?.user?.id, activeOrgId]
  )

  const confirmRemoveMember = useCallback(
    async (shouldReduceSeats = false) => {
      const { memberId } = removeMemberDialog
      if (!session?.user || !activeOrgId || !memberId) return

      await removeMember(memberId, shouldReduceSeats)
      setRemoveMemberDialog({ open: false, memberId: '', memberName: '', shouldReduceSeats: false })
    },
    [removeMemberDialog.memberId, session?.user?.id, activeOrgId]
  )

  const handleReduceSeats = useCallback(async () => {
    if (!session?.user || !activeOrgId || !subscriptionData) return
    if (checkEnterprisePlan(subscriptionData)) return

    const currentSeats = subscriptionData.seats || 0
    if (currentSeats <= 1) return

    const { used: totalCount } = usedSeats
    if (totalCount >= currentSeats) return

    await reduceSeats(currentSeats - 1)
  }, [session?.user?.id, activeOrgId, subscriptionData?.seats, usedSeats.used])

  const handleAddSeatDialog = useCallback(() => {
    if (subscriptionData) {
      setNewSeatCount((subscriptionData.seats || 1) + 1)
      setIsAddSeatDialogOpen(true)
    }
  }, [subscriptionData?.seats])

  const confirmAddSeats = useCallback(
    async (selectedSeats?: number) => {
      if (!subscriptionData || !activeOrgId) return

      const seatsToUse = selectedSeats || newSeatCount
      setIsUpdatingSeats(true)

      try {
        await addSeats(seatsToUse)
        setIsAddSeatDialogOpen(false)
      } finally {
        setIsUpdatingSeats(false)
      }
    },
    [subscriptionData?.id, activeOrgId, newSeatCount]
  )

  const handleOrgInputChange = useCallback((field: string, value: string) => {
    setOrgFormData({ [field]: value })
  }, [])

  const handleSaveOrgSettings = useCallback(async () => {
    if (!activeOrgId || !adminOrOwner) return
    await updateOrganizationSettings()
  }, [activeOrgId, adminOrOwner])

  const confirmTeamUpgrade = useCallback(
    async (seats: number) => {
      if (!session?.user || !activeOrgId) return
      logger.info('Team upgrade requested', { seats, organizationId: activeOrgId })
      alert(`Team upgrade to ${seats} seats - integration needed`)
    },
    [session?.user?.id, activeOrgId]
  )

  if (isLoading && !activeOrganization && !(hasTeamPlan || hasEnterprisePlan)) {
    return (
      <div className='space-y-2 p-6'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-4 w-3/4' />
      </div>
    )
  }

  if (!activeOrganization) {
    return (
      <NoOrganizationView
        hasTeamPlan={hasTeamPlan}
        hasEnterprisePlan={hasEnterprisePlan}
        orgName={orgName}
        setOrgName={setOrgName}
        orgSlug={orgSlug}
        setOrgSlug={setOrgSlug}
        onOrgNameChange={handleOrgNameChange}
        onCreateOrganization={handleCreateOrganization}
        isCreatingOrg={isCreatingOrg}
        error={error}
        createOrgDialogOpen={createOrgDialogOpen}
        setCreateOrgDialogOpen={setCreateOrgDialogOpen}
      />
    )
  }

  return (
    <div className='space-y-4 p-6'>
      <div className='flex items-center justify-between'>
        <h3 className='font-medium text-sm'>Team Management</h3>

        {organizations.length > 1 && (
          <div className='flex items-center space-x-2'>
            <select
              className='h-9 rounded-[8px] border border-input bg-background px-3 py-2 text-xs'
              value={activeOrganization.id}
              onChange={(e) => setActiveOrganization(e.target.value)}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <Alert variant='destructive' className='rounded-[8px]'>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='members'>Members</TabsTrigger>
          <TabsTrigger value='usage'>Usage</TabsTrigger>
          <TabsTrigger value='settings'>Settings</TabsTrigger>
        </TabsList>

        <TabsContent value='members' className='mt-4 space-y-4'>
          {adminOrOwner && (
            <MemberInvitationCard
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              isInviting={isInviting}
              showWorkspaceInvite={showWorkspaceInvite}
              setShowWorkspaceInvite={setShowWorkspaceInvite}
              selectedWorkspaces={selectedWorkspaces}
              userWorkspaces={userWorkspaces}
              onInviteMember={handleInviteMember}
              onLoadUserWorkspaces={() => loadUserWorkspaces(session?.user?.id)}
              onWorkspaceToggle={handleWorkspaceToggle}
              inviteSuccess={inviteSuccess}
            />
          )}

          {adminOrOwner && (
            <TeamSeatsOverview
              subscriptionData={subscriptionData}
              isLoadingSubscription={isLoadingSubscription}
              usedSeats={usedSeats.used}
              isLoading={isLoading}
              onConfirmTeamUpgrade={confirmTeamUpgrade}
              onReduceSeats={handleReduceSeats}
              onAddSeatDialog={handleAddSeatDialog}
            />
          )}

          <TeamMembersList
            organization={activeOrganization}
            currentUserEmail={session?.user?.email ?? ''}
            isAdminOrOwner={adminOrOwner}
            onRemoveMember={handleRemoveMember}
          />

          {adminOrOwner && (activeOrganization.invitations?.length ?? 0) > 0 && (
            <PendingInvitationsList
              organization={activeOrganization}
              onCancelInvitation={cancelInvitation}
            />
          )}
        </TabsContent>

        <TabsContent value='usage' className='mt-4 space-y-4'>
          <TeamUsage hasAdminAccess={adminOrOwner} />
        </TabsContent>

        <TabsContent value='settings'>
          <OrganizationSettingsTab
            organization={activeOrganization}
            isAdminOrOwner={adminOrOwner}
            userRole={userRole}
            orgFormData={orgFormData}
            onOrgInputChange={handleOrgInputChange}
            onSaveOrgSettings={handleSaveOrgSettings}
            isSavingOrgSettings={isSavingOrgSettings}
            orgSettingsError={orgSettingsError}
            orgSettingsSuccess={orgSettingsSuccess}
          />
        </TabsContent>
      </Tabs>

      <RemoveMemberDialog
        open={removeMemberDialog.open}
        memberName={removeMemberDialog.memberName}
        shouldReduceSeats={removeMemberDialog.shouldReduceSeats}
        onOpenChange={(open: boolean) => {
          if (!open) setRemoveMemberDialog({ ...removeMemberDialog, open: false })
        }}
        onShouldReduceSeatsChange={(shouldReduce: boolean) =>
          setRemoveMemberDialog({
            ...removeMemberDialog,
            shouldReduceSeats: shouldReduce,
          })
        }
        onConfirmRemove={confirmRemoveMember}
        onCancel={() =>
          setRemoveMemberDialog({
            open: false,
            memberId: '',
            memberName: '',
            shouldReduceSeats: false,
          })
        }
      />

      <TeamSeats
        open={isAddSeatDialogOpen}
        onOpenChange={setIsAddSeatDialogOpen}
        title='Add Team Seats'
        description={`Each seat costs $${env.TEAM_TIER_COST_LIMIT}/month and provides $${env.TEAM_TIER_COST_LIMIT} in monthly inference credits. Adjust the number of licensed seats for your team.`}
        currentSeats={subscriptionData?.seats || 1}
        initialSeats={newSeatCount}
        isLoading={isUpdatingSeats}
        onConfirm={async (selectedSeats: number) => {
          setNewSeatCount(selectedSeats)
          await confirmAddSeats(selectedSeats)
        }}
        confirmButtonText='Update Seats'
        showCostBreakdown={true}
      />
    </div>
  )
}
