import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Throttling cho get-session
const sessionThrottle = new Map<string, { response: any; timestamp: number }>()
const SESSION_CACHE_DURATION = 5000 // 5 giây

const originalHandlers = toNextJsHandler(auth.handler)

export const GET = async (request: Request) => {
  const url = new URL(request.url)
  
  // Throttle get-session requests
  if (url.pathname.includes('get-session')) {
    const clientId = request.headers.get('x-forwarded-for') || 
                     request.headers.get('user-agent') || 
                     'anonymous'
    
    const cached = sessionThrottle.get(clientId)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < SESSION_CACHE_DURATION) {
      console.log('🚫 Throttled get-session request')
      return new Response(JSON.stringify(cached.response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=5'
        }
      })
    }
    
    console.log('✅ Processing get-session request')
    const response = await originalHandlers.GET(request)
    
    // Cache response
    try {
      const responseClone = response.clone()
      const responseData = await responseClone.json()
      sessionThrottle.set(clientId, {
        response: responseData,
        timestamp: now
      })
      
      // Cleanup old entries
      setTimeout(() => {
        sessionThrottle.delete(clientId)
      }, SESSION_CACHE_DURATION)
      
    } catch (e) {
      console.log('Could not cache session response')
    }
    
    return response
  }
  
  console.log('=== Auth GET Request Debug ===')
  console.log('URL:', request.url)
  console.log('Method:', request.method)
  console.log('Pathname:', url.pathname)
  console.log('Search params:', Object.fromEntries(url.searchParams.entries()))
  console.log('================================')
  
  return originalHandlers.GET(request)
}

export const POST = async (request: Request) => {
  console.log('=== Auth POST Request Debug ===')
  console.log('URL:', request.url)
  console.log('Method:', request.method)
  console.log('Headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    const body = await request.clone().text()
    console.log('Body:', body)
  } catch (e) {
    console.log('Could not read body')
  }
  
  console.log('=================================')
  
  return originalHandlers.POST(request)
}