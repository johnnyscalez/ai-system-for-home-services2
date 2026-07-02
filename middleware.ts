import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isTech = user?.app_metadata?.role === "technician"

  const isAuthRoute   = path === "/login" || path === "/signup"
  const isTechLogin   = path === "/tech/login"
  const isTechRoute   = (path === "/tech" || path.startsWith("/tech/")) && !isTechLogin
  const isPublicRoute =
    path === "/" ||
    path === "/start" ||
    path === "/start/tab" ||
    path === "/start/tech" ||
    path === "/start/hire" ||
    path === "/api/health" ||
    path.startsWith("/api/webhooks") ||
    path.startsWith("/api/voice") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/test") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/dev") ||
    path.startsWith("/api/tech/") ||
    path.startsWith("/api/property-image") ||
    path.endsWith(".html")
  const isProtected = !isAuthRoute && !isTechLogin && !isPublicRoute

  // Unauthenticated: redirect to the right login page
  if (!user) {
    if (isTechRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/tech/login"
      return NextResponse.redirect(url)
    }
    if (isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Authenticated technician — keep them inside /tech/* only
  if (isTech) {
    // Redirect away from admin login/signup to their portal
    if (isAuthRoute || path === "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/tech/appointments"
      return NextResponse.redirect(url)
    }
    // Redirect from /tech/login → /tech/appointments (already logged in)
    if (isTechLogin) {
      const url = request.nextUrl.clone()
      url.pathname = "/tech/appointments"
      return NextResponse.redirect(url)
    }
    // Block techs from accessing admin dashboard routes
    if (!isTechRoute && isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = "/tech/appointments"
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Authenticated admin/owner/member — keep them out of /tech/* routes
  if (isTechRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Redirect logged-in admin away from /login
  if (path === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Admins can visit /tech/login (useful for testing the tech portal)
  // Just pass through — don't redirect them away

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
