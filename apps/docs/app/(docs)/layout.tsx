import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { ExternalLink, GithubIcon } from 'lucide-react'
import Link from 'next/link'
import { source } from '@/lib/source'

const GitHubLink = () => (
  <></>
)

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: <div className='flex items-center font-medium'>Nuggets</div>,
        }}
        links={[
          {
            text: 'Visit Nuggets',
            url: 'https://nuggets.ai',
            icon: <ExternalLink className='h-4 w-4' />,
          },
        ]}
        sidebar={{
          defaultOpenLevel: 1,
          collapsible: true,
          footer: null,
        }}
      >
        {children}
      </DocsLayout>
      <GitHubLink />
    </>
  )
}
