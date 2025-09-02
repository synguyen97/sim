import { createLogger } from '@/lib/logs/console/logger'
import type { LatestCommitParams, LatestCommitResponse } from '@/tools/github/types'
import type { ToolConfig } from '@/tools/types'

const logger = createLogger('GitHubLatestCommitTool')

export const latestCommitTool: ToolConfig<LatestCommitParams, LatestCommitResponse> = {
  id: 'github_latest_commit',
  name: 'GitHub Latest Commit',
  description: 'Retrieve the latest commit from a GitHub repository',
  version: '1.0.0',

  params: {
    owner: {
      type: 'string',
      required: true,
      visibility: 'user-or-llm',
      description: 'Repository owner (user or organization)',
    },
    repo: {
      type: 'string',
      required: true,
      visibility: 'user-or-llm',
      description: 'Repository name',
    },
    branch: {
      type: 'string',
      required: false,
      visibility: 'user-or-llm',
      description: "Branch name (defaults to the repository's default branch)",
    },
    apiKey: {
      type: 'string',
      required: true,
      visibility: 'user-only',
      description: 'GitHub API token',
    },
  },

  request: {
    url: (params) => {
      const baseUrl = `https://api.github.com/repos/${params.owner}/${params.repo}`
      return params.branch ? `${baseUrl}/commits/${params.branch}` : `${baseUrl}/commits/HEAD`
    },
    method: 'GET',
    headers: (params) => ({
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${params.apiKey}`,
      'X-GitHub-Api-Version': '2022-11-28',
    }),
  },

  transformResponse: async (response, params) => {
    const data = await response.json()

    const content = `Latest commit: "${data.commit.message}" by ${data.commit.author.name} on ${data.commit.author.date}. SHA: ${data.sha}`

    const files = data.files || []
    const fileDetailsWithContent = []

    if (files.length > 0) {
      for (const file of files) {
        const fileDetail = {
          filename: file.filename,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          status: file.status,
          raw_url: file.raw_url,
          blob_url: file.blob_url,
          patch: file.patch,
          content: undefined as string | undefined,
        }

        if (file.status !== 'removed' && file.raw_url) {
          try {
            const contentResponse = await fetch(file.raw_url, {
              headers: {
                Authorization: `Bearer ${params?.apiKey}`,
                'X-GitHub-Api-Version': '2022-11-28',
              },
            })

            if (contentResponse.ok) {
              fileDetail.content = await contentResponse.text()
            }
          } catch (error) {
            logger.error(`Failed to fetch content for ${file.filename}:`, error)
          }
        }

        fileDetailsWithContent.push(fileDetail)
      }
    }

    return {
      success: true,
      output: {
        content,
        metadata: {
          sha: data.sha,
          html_url: data.html_url,
          commit_message: data.commit.message,
          author: {
            name: data.commit.author.name,
            login: data.author?.login || 'Unknown',
            avatar_url: data.author?.avatar_url || '',
            html_url: data.author?.html_url || '',
          },
          committer: {
            name: data.commit.committer.name,
            login: data.committer?.login || 'Unknown',
            avatar_url: data.committer?.avatar_url || '',
            html_url: data.committer?.html_url || '',
          },
          stats: data.stats
            ? {
                additions: data.stats.additions,
                deletions: data.stats.deletions,
                total: data.stats.total,
              }
            : undefined,
          files: fileDetailsWithContent.length > 0 ? fileDetailsWithContent : undefined,
        },
      },
    }
  },

  outputs: {
    content: { type: 'string', description: 'Human-readable commit summary' },
    metadata: {
      type: 'object',
      description: 'Commit metadata',
    },
  },
}
