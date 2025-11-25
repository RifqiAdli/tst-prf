import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function MonitoringPage({ params }: { params: Promise<{ scheduleId: string }> }) {
  const { scheduleId } = await params
  const supabase = await createClient()

  const { data: schedule } = await supabase.from("test_schedules").select("*").eq("id", scheduleId).single()

  const { data: participants } = await supabase
    .from("schedule_participants")
    .select("*, profiles(*), test_sessions(*)")
    .eq("schedule_id", scheduleId)

  const { data: logs } = await supabase
    .from("activity_logs")
    .select("*, profiles(full_name, email)")
    .eq("schedule_id", scheduleId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/schedules">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{schedule?.name}</h1>
          <p className="text-muted-foreground">Monitoring peserta test</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Peserta ({participants?.length || 0})</CardTitle>
          <CardDescription>Status peserta dalam test ini</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Pelanggaran</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants?.map((p) => {
                const session = p.test_sessions?.[0]
                const hasStarted = !!session
                const hasEnded = session?.ended_at
                const progress = session
                  ? Math.round((session.current_question / (schedule?.total_questions || 1)) * 100)
                  : 0

                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.profiles?.full_name || "-"}</TableCell>
                    <TableCell>{p.profiles?.email}</TableCell>
                    <TableCell>
                      <Badge variant={hasEnded ? "secondary" : hasStarted ? "default" : "outline"}>
                        {hasEnded ? "Selesai" : hasStarted ? "Mengerjakan" : "Belum Mulai"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="w-20" />
                        <span className="text-sm text-muted-foreground">{progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={session?.violation_count > 0 ? "destructive" : "outline"}>
                        {session?.violation_count || 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Log aktivitas mencurigakan</CardDescription>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Aktivitas</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">{new Date(log.created_at).toLocaleString("id-ID")}</TableCell>
                    <TableCell>{log.profiles?.full_name || log.profiles?.email}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{log.activity_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada aktivitas mencurigakan</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
