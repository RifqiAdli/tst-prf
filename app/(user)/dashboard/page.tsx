import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, FileQuestion, Trophy, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { id } from "date-fns/locale"

export default async function UserDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).single()

  // Get user's test schedules
  const { data: participations } = await supabase
    .from("schedule_participants")
    .select(`
      *,
      schedule:test_schedules(*)
    `)
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false })

  // Get user's results
  const { data: results } = await supabase
    .from("test_results")
    .select(`
      *,
      schedule:test_schedules(title)
    `)
    .eq("user_id", user?.id)
    .limit(5)

  const now = new Date()
  const upcomingTests =
    participations?.filter((p) => p.schedule && new Date(p.schedule.start_time) > now && p.status === "assigned") || []

  const activeTests =
    participations?.filter(
      (p) =>
        p.schedule &&
        new Date(p.schedule.start_time) <= now &&
        new Date(p.schedule.end_time) >= now &&
        (p.status === "assigned" || p.status === "in_progress"),
    ) || []

  const completedCount =
    participations?.filter((p) => p.status === "completed" || p.status === "force_submitted").length || 0

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold">Selamat Datang, {profile?.full_name}</h1>
        <p className="text-muted-foreground">Berikut ringkasan aktivitas test Anda</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Akan Datang</p>
                <p className="text-2xl font-bold">{upcomingTests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <Clock className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sedang Berlangsung</p>
                <p className="text-2xl font-bold">{activeTests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Trophy className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selesai</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-500/10">
                <FileQuestion className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Test</p>
                <p className="text-2xl font-bold">{participations?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Tests */}
      {activeTests.length > 0 && (
        <Card className="border-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              Test Sedang Berlangsung
            </CardTitle>
            <CardDescription>Test yang bisa Anda kerjakan sekarang</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeTests.map((participation) => (
                <div
                  key={participation.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-accent/5"
                >
                  <div className="space-y-1">
                    <h3 className="font-medium">{participation.schedule?.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {participation.schedule?.duration_minutes} menit
                      </span>
                      <span className="flex items-center gap-1">
                        <FileQuestion className="h-4 w-4" />
                        {participation.schedule?.question_count} soal
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Berakhir:{" "}
                      {format(new Date(participation.schedule?.end_time), "dd MMM yyyy, HH:mm", { locale: id })}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/test/${participation.schedule_id}`}>
                      {participation.status === "in_progress" ? "Lanjutkan" : "Mulai Test"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Tests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Jadwal Mendatang</CardTitle>
              <CardDescription>Test yang akan datang</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/schedules">
                Lihat Semua
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingTests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada jadwal test mendatang</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingTests.slice(0, 3).map((participation) => (
                <div key={participation.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <h3 className="font-medium">{participation.schedule?.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {format(new Date(participation.schedule?.start_time), "dd MMM yyyy, HH:mm", { locale: id })}
                      </span>
                      <Badge variant="secondary">{participation.schedule?.duration_minutes} menit</Badge>
                    </div>
                  </div>
                  <Badge>Akan Datang</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Results */}
      {results && results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Hasil Test Terbaru</CardTitle>
                <CardDescription>Riwayat test yang telah selesai</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/history">
                  Lihat Semua
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result) => (
                <div key={result.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <h3 className="font-medium">{result.schedule?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(result.submitted_at), "dd MMM yyyy, HH:mm", { locale: id })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{result.score?.toFixed(0) || "-"}%</p>
                    <p className="text-xs text-muted-foreground">
                      {result.answered_questions}/{result.total_questions} dijawab
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
