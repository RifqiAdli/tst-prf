import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export default async function MonitoringPage() {
  const supabase = await createClient()

  const { data: activeSessions } = await supabase
    .from("test_sessions")
    .select("*, profiles(full_name, email), test_schedules(name, duration_minutes)")
    .is("ended_at", null)
    .order("started_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Real-time Monitoring</h1>
        <p className="text-muted-foreground">Pantau peserta yang sedang mengerjakan test</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Peserta Aktif ({activeSessions?.length || 0})</CardTitle>
          <CardDescription>Peserta yang sedang mengerjakan test saat ini</CardDescription>
        </CardHeader>
        <CardContent>
          {activeSessions && activeSessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Waktu Tersisa</TableHead>
                  <TableHead>Pelanggaran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSessions.map((session) => {
                  const startTime = new Date(session.started_at).getTime()
                  const durationMs = (session.test_schedules?.duration_minutes || 60) * 60 * 1000
                  const endTime = startTime + durationMs
                  const remaining = Math.max(0, endTime - Date.now())
                  const remainingMins = Math.floor(remaining / 60000)

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="font-medium">{session.profiles?.full_name || "-"}</div>
                        <div className="text-xs text-muted-foreground">{session.profiles?.email}</div>
                      </TableCell>
                      <TableCell>{session.test_schedules?.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={session.current_question * 10} className="w-20" />
                          <span className="text-sm">{session.current_question}/10</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={remainingMins < 5 ? "destructive" : "secondary"}>{remainingMins} menit</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.violation_count > 0 ? "destructive" : "outline"}>
                          {session.violation_count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada peserta yang sedang mengerjakan test</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
