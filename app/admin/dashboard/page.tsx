import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileQuestion, Calendar, PlayCircle, UserCheck } from "lucide-react"

async function getStats() {
  const supabase = await createClient()

  const [usersResult, questionsResult, schedulesResult, activeSessionsResult] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact" }).eq("role", "user"),
    supabase.from("questions").select("id", { count: "exact" }),
    supabase.from("test_schedules").select("id", { count: "exact" }),
    supabase.from("test_sessions").select("id", { count: "exact" }).is("ended_at", null),
  ])

  return {
    totalUsers: usersResult.count || 0,
    totalQuestions: questionsResult.count || 0,
    totalSchedules: schedulesResult.count || 0,
    activeSessions: activeSessionsResult.count || 0,
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats()

  const statCards = [
    { title: "Total User", value: stats.totalUsers, icon: Users, description: "Pengguna terdaftar" },
    { title: "Bank Soal", value: stats.totalQuestions, icon: FileQuestion, description: "Total soal tersedia" },
    { title: "Jadwal Test", value: stats.totalSchedules, icon: Calendar, description: "Jadwal dibuat" },
    { title: "Test Aktif", value: stats.activeSessions, icon: PlayCircle, description: "Sedang berlangsung" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Admin</h1>
        <p className="text-muted-foreground">Selamat datang di panel administrasi</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Peserta Aktif
            </CardTitle>
            <CardDescription>Peserta yang sedang mengerjakan test</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.activeSessions > 0 ? (
              <p className="text-sm text-muted-foreground">{stats.activeSessions} peserta sedang mengerjakan test</p>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak ada peserta yang sedang mengerjakan test</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Aksi cepat untuk administrasi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/admin/schedules/create" className="block text-sm text-primary hover:underline">
              + Buat Jadwal Baru
            </a>
            <a href="/admin/questions/create" className="block text-sm text-primary hover:underline">
              + Tambah Soal
            </a>
            <a href="/admin/users" className="block text-sm text-primary hover:underline">
              Kelola Pengguna
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
