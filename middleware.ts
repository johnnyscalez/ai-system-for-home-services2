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
    path.startsWith("/start/") ||
    path === "/book" ||
    path === "/optin" ||
    path === "/privacy" ||
    path === "/terms" ||
    // Per-client SMS privacy and terms pages (carriers read these during A2P review)
    path.startsWith("/legal/") ||
    path === "/api/health" ||
    path === "/api/track" ||
    path === "/api/lead-intake" ||
    path === "/api/book" ||
    path === "/api/book/slots" ||
    path === "/api/floor-render" ||
    path.startsWith("/api/webhooks") ||
    path.startsWith("/api/voice") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/test") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/dev") ||
    path.startsWith("/api/tech/") ||
    path.startsWith("/api/property-image") ||
    path.endsWith(".html") ||
    // Static assets served from /public (images, fonts, media). Without this
    // they get redirected to /login and render as broken images on the
    // public marketing pages.
    /\.(png|jpe?g|svg|gif|webp|avif|ico|mp4|webm|woff2?|ttf|txt|xml|pdf)$/i.test(path)
  const isProtected = !isAuthRoute && !isTechLogin && !isPublicRoute

  // Test endpoints run real AI conversations against real companies. All of them
  // except /api/test/lead (which checks the signed-in session itself) were open
  // to anyone. They now need the cron secret.
  if (path.startsWith("/api/test/") && path !== "/api/test/lead") {
    const auth = request.headers.get("authorization")
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // The technician portal (/tech, its login and its APIs) is kept in the code
  // but hidden: flooring accounts run measures without technician logins.
  // TECH_PORTAL_ENABLED=true brings it back as it was.
  if (process.env.TECH_PORTAL_ENABLED !== "true") {
    const portalPath = isTechLogin || isTechRoute || path.startsWith("/api/tech/")
    if (portalPath || (isTech && (isProtected || isAuthRoute))) {
      if (path.startsWith("/api/")) return NextResponse.json({ error: "Not found" }, { status: 404 })
      if (isTech) {
        // A technician login has nowhere to go while the portal is off. A plain
        // page, not a redirect: /login would bounce a signed-in technician back here.
        return new NextResponse("The technician portal is turned off. Please contact your office.", {
          status: 403, headers: { "content-type": "text/plain; charset=utf-8" },
        })
      }
      const url = request.nextUrl.clone()
      url.pathname = user ? "/dashboard" : "/login"
      return NextResponse.redirect(url)
    }
  }

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
