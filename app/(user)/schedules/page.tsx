import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, FileQuestion, ArrowRight, CalendarX } from "lucide-react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"
import { redirect } from "next/navigation"

function getTestStatus(schedule: { start_time: string; end_time: string }, participantStatus: string) {
  const now = new Date()
  const start = new Date(schedule.start_time)
  const end = new Date(schedule.end_time)

  if (participantStatus === "completed" || participantStatus === "force_submitted") {
    return { label: "Selesai", variant: "default" as const, color: "text-green-600" }
  }
  if (now < start) {
    return { label: "Akan Datang", variant: "secondary" as const, color: "text-blue-600" }
  }
  if (now >= start && now <= end) {
    return { label: "Berlangsung", variant: "default" as const, color: "text-accent" }
  }
  return { label: "Terlewat", variant: "destructive" as const, color: "text-destructive" }
}

export default async function SchedulesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: participations, error } = await supabase
    .from("schedule_participants")
    .select(`
      *,
      schedule:test_schedules!inner(*)
    `)
    .eq("user_id", user.id)
    .eq("schedule.is_published", true)

  if (error) {
    console.error("Error fetching schedules:", error)
  }

  const now = new Date()

  // Sort by schedule start time
  const sortedParticipations = (participations || []).sort((a, b) => {
    if (!a.schedule || !b.schedule) return 0
    return new Date(b.schedule.start_time).getTime() - new Date(a.schedule.start_time).getTime()
  })

  const activeTests =
    sortedParticipations.filter(
      (p) =>
        p.schedule &&
        new Date(p.schedule.start_time) <= now &&
        new Date(p.schedule.end_time) >= now &&
        p.status !== "completed" &&
        p.status !== "force_submitted",
    ) || []

  const upcomingTests =
    sortedParticipations.filter(
      (p) => 
        p.schedule && 
        new Date(p.schedule.start_time) > now && 
        p.status === "assigned"
    ) || []

  const completedTests = 
    sortedParticipations.filter(
      (p) => p.status === "completed" || p.status === "force_submitted"
    ) || []

  const missedTests =
    sortedParticipations.filter(
      (p) => 
        p.schedule && 
        new Date(p.schedule.end_time) < now && 
        p.status === "assigned"
    ) || []

  const TestCard = ({
    participation,
  }: { participation: typeof participations extends (infer T)[] | null ? T : never }) => {
    if (!participation?.schedule) return null
    const status = getTestStatus(participation.schedule, participation.status)
    const isActive = status.label === "Berlangsung"
    const canStart = isActive && participation.status !== "completed"

    return (
      <Card className={isActive ? "border-accent" : ""}>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{participation.schedule.title}</h3>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              {participation.schedule.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{participation.schedule.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(participation.schedule.start_time), "dd MMM yyyy, HH:mm", { locale: id })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {participation.schedule.duration_minutes} menit
                </span>
                <span className="flex items-center gap-1">
                  <FileQuestion className="h-4 w-4" />
                  {participation.schedule.question_count} soal
                </span>
              </div>
              {status.label === "Akan Datang" && (
                <p className="text-sm text-primary">
                  Dimulai{" "}
                  {formatDistanceToNow(new Date(participation.schedule.start_time), { addSuffix: true, locale: id })}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              {canStart ? (
                <Button asChild>
                  <Link href={`/test/${participation.schedule_id}`}>
                    {participation.status === "in_progress" ? "Lanjutkan" : "Mulai Test"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : status.label === "Selesai" ? (
                <Button variant="outline" asChild>
                  <Link href={`/history/${participation.schedule_id}`}>Lihat Hasil</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-12 text-muted-foreground">
      <CalendarX className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p>{message}</p>
    </div>
  )

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 text-destructive">
          <p>Gagal memuat jadwal test. Silakan refresh halaman.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jadwal Test</h1>
        <p className="text-muted-foreground">Daftar semua test yang tersedia untuk Anda</p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="gap-2">
            Berlangsung
            {activeTests.length > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 justify-center">
                {activeTests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Akan Datang</TabsTrigger>
          <TabsTrigger value="completed">Selesai</TabsTrigger>
          <TabsTrigger value="missed">Terlewat</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activeTests.length === 0 ? (
            <EmptyState message="Tidak ada test yang sedang berlangsung" />
          ) : (
            <div className="space-y-4">
              {activeTests.map((p) => (
                <TestCard key={p.id} participation={p} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          {upcomingTests.length === 0 ? (
            <EmptyState message="Tidak ada test yang akan datang" />
          ) : (
            <div className="space-y-4">
              {upcomingTests.map((p) => (
                <TestCard key={p.id} participation={p} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedTests.length === 0 ? (
            <EmptyState message="Belum ada test yang selesai" />
          ) : (
            <div className="space-y-4">
              {completedTests.map((p) => (
                <TestCard key={p.id} participation={p} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="missed" className="mt-6">
          {missedTests.length === 0 ? (
            <EmptyState message="Tidak ada test yang terlewat" />
          ) : (
            <div className="space-y-4">
              {missedTests.map((p) => (
                <TestCard key={p.id} participation={p} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}