import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  console.log('🔍 [Middleware] Request:', pathname)

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('👤 [Middleware] User:', user?.email || 'Not logged in')

  const publicRoutes = ["/", "/login"]
  const isPublicRoute = publicRoutes.includes(pathname)
  const isAdminRoute = pathname.startsWith("/admin")
  const isUserRoute = pathname.startsWith("/dashboard") || 
                      pathname.startsWith("/schedules") || 
                      pathname.startsWith("/history") || 
                      pathname.startsWith("/profile") || 
                      pathname.startsWith("/test")

  // Allow public routes
  if (isPublicRoute) {
    if (user && pathname === "/login") {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      console.log('🔍 [Middleware] Profile fetch:', { profile, error })

      // If no profile, sign out and stay on login
      if (!profile || error) {
        console.log('❌ [Middleware] No profile found, signing out')
        await supabase.auth.signOut()
        return supabaseResponse
      }

      const url = request.nextUrl.clone()
      url.pathname = profile.role === "admin" ? "/admin/dashboard" : "/dashboard"
      console.log('🔀 [Middleware] Redirect from login to:', url.pathname)
      return NextResponse.redirect(url)
    }
    console.log('✅ [Middleware] Allow public route')
    return supabaseResponse
  }

  // Require authentication
  if (!user) {
    console.log('❌ [Middleware] No user, redirect to login')
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Get user profile with error handling
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  console.log('🎭 [Middleware] Profile:', { role: profile?.role, error: profileError })

  // If profile doesn't exist, redirect to login and sign out
  if (!profile || profileError) {
    console.log('❌ [Middleware] No profile, signing out')
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  console.log('🎭 [Middleware] Role:', profile.role, '| Admin route?', isAdminRoute, '| User route?', isUserRoute)

  // Protect admin routes from non-admin
  if (isAdminRoute && profile.role !== "admin") {
    console.log('🚫 [Middleware] Non-admin blocked from admin route')
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Redirect admin from user routes to admin dashboard
  if (isUserRoute && profile.role === "admin") {
    console.log('🔀 [Middleware] Admin redirected from user route to /admin/dashboard')
    const url = request.nextUrl.clone()
    url.pathname = "/admin/dashboard"
    return NextResponse.redirect(url)
  }

  console.log('✅ [Middleware] Allow access to:', pathname)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}