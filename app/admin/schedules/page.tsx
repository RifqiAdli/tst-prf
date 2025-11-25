import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Eye } from "lucide-react"

function getScheduleStatus(schedule: any) {
  const now = new Date()
  const start = new Date(schedule.start_time)
  const end = new Date(schedule.end_time)

  if (now < start) return { label: "Akan Datang", variant: "secondary" as const }
  if (now >= start && now <= end) return { label: "Berlangsung", variant: "default" as const }
  return { label: "Selesai", variant: "outline" as const }
}

export default async function SchedulesPage() {
  const supabase = await createClient()

  const { data: schedules } = await supabase
    .from("test_schedules")
    .select("*, schedule_participants(id)")
    .order("start_time", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jadwal Test</h1>
          <p className="text-muted-foreground">Kelola jadwal pelaksanaan test</p>
        </div>
        <Button asChild>
          <Link href="/admin/schedules/create">
            <Plus className="mr-2 h-4 w-4" />
            Buat Jadwal
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Jadwal</CardTitle>
          <CardDescription>Total {schedules?.length || 0} jadwal</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Test</TableHead>
                <TableHead>Waktu Mulai</TableHead>
                <TableHead>Waktu Selesai</TableHead>
                <TableHead>Durasi</TableHead>
                <TableHead>Peserta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules?.map((schedule) => {
                const status = getScheduleStatus(schedule)
                return (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>{new Date(schedule.start_time).toLocaleString("id-ID")}</TableCell>
                    <TableCell>{new Date(schedule.end_time).toLocaleString("id-ID")}</TableCell>
                    <TableCell>{schedule.duration_minutes} menit</TableCell>
                    <TableCell>{schedule.schedule_participants?.length || 0}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/schedules/${schedule.id}/monitoring`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Monitor
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
