"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  Calendar,
  User,
  History,
  LogOut,
  ChevronUp,
  ClipboardCheck,
  Settings,
  Users,
  FileQuestion,
  CalendarClock,
  Activity,
  BarChart3,
  Shield,
} from "lucide-react"
import type { Profile } from "@/types/database.types"

interface AppSidebarProps {
  user: Profile
}

const userNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Jadwal Test", href: "/schedules", icon: Calendar },
  { title: "Riwayat", href: "/history", icon: History },
  { title: "Profil", href: "/profile", icon: User },
]

const adminNavItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Pengguna", href: "/admin/users", icon: Users },
  { title: "Bank Soal", href: "/admin/questions", icon: FileQuestion },
  { title: "Jadwal Test", href: "/admin/schedules", icon: CalendarClock },
  { title: "Monitoring", href: "/admin/monitoring", icon: Activity },
  { title: "Hasil Test", href: "/admin/results", icon: BarChart3 },
  { title: "Log Aktivitas", href: "/admin/logs", icon: Shield },
  { title: "Pengaturan", href: "/admin/settings", icon: Settings },
]

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = user.role === "admin"
  const navItems = isAdmin ? adminNavItems : userNavItems

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href={isAdmin ? "/admin/dashboard" : "/dashboard"} className="flex items-center gap-3 px-2 py-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">PreferTest</span>
            <span className="text-xs text-sidebar-foreground/60">{isAdmin ? "Admin Panel" : "User Portal"}</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">{isAdmin ? "Manajemen" : "Menu"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + "/")}>
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-auto py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left min-w-0 flex-1">
                    <span className="text-sm font-medium truncate w-full text-sidebar-foreground">
                      {user.full_name}
                    </span>
                    <span className="text-xs text-sidebar-foreground/60 truncate w-full">{user.email}</span>
                  </div>
                  <ChevronUp className="w-4 h-4 text-sidebar-foreground/60" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href={isAdmin ? "/admin/settings" : "/profile"}>
                    <User className="mr-2 h-4 w-4" />
                    {isAdmin ? "Pengaturan" : "Profil Saya"}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
