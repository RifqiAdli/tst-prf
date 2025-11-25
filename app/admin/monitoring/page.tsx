"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, MoreVertical, StopCircle, Pause, Eye, AlertTriangle, MessageSquare, Send, Megaphone } from "lucide-react"
import { toast } from "sonner"

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  current_question_index: number
  strike_count: number
  status: string
  time_remaining_seconds: number | null
  question_order: number[] | null
  profiles: {
    full_name: string
    email: string
  } | null
  test_schedules: {
    title: string
    duration_minutes: number
    question_count: number
  } | null
}

type ActivityLog = {
  id: string
  activity_type: string
  details: any
  action_taken: string | null
  created_at: string
}

export default function MonitoringPage() {
  const [activeSessions, setActiveSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [showForceStop, setShowForceStop] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Message states
  const [showGlobalMessage, setShowGlobalMessage] = useState(false)
  const [showPersonalMessage, setShowPersonalMessage] = useState(false)
  const [messageText, setMessageText] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  
  const supabase = createClient()

  const fetchActiveSessions = async () => {
    const { data, error } = await supabase
      .from("test_sessions")
      .select(`
        id,
        started_at,
        ended_at,
        current_question_index,
        strike_count,
        status,
        time_remaining_seconds,
        question_order,
        profiles:user_id (
          full_name,
          email
        ),
        test_schedules:schedule_id (
          title,
          duration_minutes,
          question_count
        )
      `)
      .eq("status", "active")
      .is("ended_at", null)
      .order("started_at", { ascending: false })

    if (error) {
      console.error("Error fetching sessions:", error)
    } else {
      setActiveSessions(data || [])
      setLastUpdate(new Date())
    }
    setLoading(false)
  }

  const fetchActivityLogs = async (sessionId: string) => {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      console.error("Error fetching logs:", error)
      toast.error("Gagal memuat log aktivitas")
    } else {
      setActivityLogs(data || [])
    }
  }

  useEffect(() => {
    fetchActiveSessions()

    const channel = supabase
      .channel("test_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "test_sessions",
        },
        (payload) => {
          console.log("Realtime update:", payload)
          fetchActiveSessions()
        }
      )
      .subscribe()

    const logsChannel = supabase
      .channel("activity_logs_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
        },
        () => {
          fetchActiveSessions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(logsChannel)
    }
  }, [])

  const handleForceStop = async () => {
    if (!selectedSession) return

    setActionLoading(true)
    try {
      const { error: sessionError } = await supabase
        .from("test_sessions")
        .update({
          status: "force_submitted",
          ended_at: new Date().toISOString(),
        })
        .eq("id", selectedSession.id)

      if (sessionError) throw sessionError

      const { error: participantError } = await supabase
        .from("schedule_participants")
        .update({ status: "force_submitted" })
        .eq("schedule_id", selectedSession.test_schedules?.title)
        .eq("user_id", selectedSession.profiles?.email)

      await supabase.from("activity_logs").insert({
        session_id: selectedSession.id,
        user_id: selectedSession.profiles?.email,
        schedule_id: selectedSession.test_schedules?.title,
        activity_type: "tab_switch",
        action_taken: "terminated",
        details: { reason: "Force stopped by admin" },
      })

      toast.success("Sesi test berhasil dihentikan paksa")
      setShowForceStop(false)
      fetchActiveSessions()
    } catch (error) {
      console.error("Error force stopping session:", error)
      toast.error("Gagal menghentikan sesi test")
    } finally {
      setActionLoading(false)
    }
  }

  const handlePause = async (session: Session) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from("test_sessions")
        .update({
          time_remaining_seconds: calculateRealTimeRemaining(
            session.started_at,
            session.test_schedules?.duration_minutes || 60
          ),
        })
        .eq("id", session.id)

      if (error) throw error

      toast.success("Timer sesi telah disimpan")
      fetchActiveSessions()
    } catch (error) {
      console.error("Error pausing session:", error)
      toast.error("Gagal menjeda sesi")
    } finally {
      setActionLoading(false)
    }
  }

  const handleViewDetails = async (session: Session) => {
    setSelectedSession(session)
    setShowDetails(true)
    await fetchActivityLogs(session.id)
  }

  // Send Global Message to all active participants
  const handleSendGlobalMessage = async () => {
    if (!messageText.trim()) {
      toast.error("Pesan tidak boleh kosong")
      return
    }

    setSendingMessage(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Insert message for each active session
      const messages = activeSessions.map((session) => ({
        session_id: session.id,
        sender_id: user?.id,
        sender_name: "Admin",
        message: messageText,
        is_global: true,
        is_read: false,
      }))

      const { error } = await supabase.from("test_messages").insert(messages)

      if (error) throw error

      toast.success(`Pesan berhasil dikirim ke ${activeSessions.length} peserta`)
      setShowGlobalMessage(false)
      setMessageText("")
    } catch (error) {
      console.error("Error sending global message:", error)
      toast.error("Gagal mengirim pesan")
    } finally {
      setSendingMessage(false)
    }
  }

  // Send Personal Message to specific participant
  const handleSendPersonalMessage = async () => {
    if (!messageText.trim() || !selectedSession) {
      toast.error("Pesan tidak boleh kosong")
      return
    }

    setSendingMessage(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from("test_messages").insert({
        session_id: selectedSession.id,
        sender_id: user?.id,
        sender_name: "Admin",
        message: messageText,
        is_global: false,
        is_read: false,
      })

      if (error) throw error

      toast.success(`Pesan berhasil dikirim ke ${selectedSession.profiles?.full_name}`)
      setShowPersonalMessage(false)
      setMessageText("")
    } catch (error) {
      console.error("Error sending personal message:", error)
      toast.error("Gagal mengirim pesan")
    } finally {
      setSendingMessage(false)
    }
  }

  const calculateTimeRemaining = (
    startedAt: string,
    durationMinutes: number,
    timeRemainingSeconds?: number | null
  ) => {
    if (timeRemainingSeconds !== null && timeRemainingSeconds !== undefined) {
      return Math.max(0, Math.floor(timeRemainingSeconds / 60))
    }

    const startTime = new Date(startedAt).getTime()
    const durationMs = durationMinutes * 60 * 1000
    const endTime = startTime + durationMs
    const remaining = Math.max(0, endTime - Date.now())
    return Math.floor(remaining / 60000)
  }

  const calculateRealTimeRemaining = (startedAt: string, durationMinutes: number) => {
    const startTime = new Date(startedAt).getTime()
    const durationMs = durationMinutes * 60 * 1000
    const endTime = startTime + durationMs
    const remaining = Math.max(0, endTime - Date.now())
    return Math.floor(remaining / 1000)
  }

  const calculateTimeElapsed = (startedAt: string) => {
    const elapsed = Date.now() - new Date(startedAt).getTime()
    const minutes = Math.floor(elapsed / 60000)
    return minutes
  }

  const formatActivityType = (type: string) => {
    const formatMap: Record<string, string> = {
      tab_switch: "Ganti Tab",
      screen_blur: "Layar Blur",
      fullscreen_exit: "Keluar Fullscreen",
      print_screen: "Screenshot",
      devtools: "DevTools",
      copy_paste: "Copy/Paste",
      mouse_leave: "Mouse Keluar",
      window_resize: "Resize Window",
      right_click: "Klik Kanan",
    }
    return formatMap[type] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Real-time Monitoring</h1>
          <p className="text-muted-foreground">Pantau peserta yang sedang mengerjakan test</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowGlobalMessage(true)} variant="outline" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Broadcast Message
          </Button>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">Live</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Update terakhir: {lastUpdate.toLocaleTimeString("id-ID")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peserta Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions.length}</div>
            <p className="text-xs text-muted-foreground">Sedang mengerjakan test</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Strikes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeSessions.reduce((sum, s) => sum + (s.strike_count || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Pelanggaran terdeteksi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hampir Selesai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeSessions.filter((s) => {
                const questionCount = s.test_schedules?.question_count || 30
                const progress = ((s.current_question_index + 1) / questionCount) * 100
                return progress >= 80
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Progress ≥ 80%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Peserta Aktif ({activeSessions.length})</CardTitle>
          <CardDescription>
            Data diperbarui secara real-time menggunakan Supabase Realtime
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSessions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peserta</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Strikes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSessions.map((session) => {
                    const questionCount = session.test_schedules?.question_count || 30
                    const currentQuestion = session.current_question_index + 1
                    const progressPercent = (currentQuestion / questionCount) * 100

                    const remainingMins = calculateTimeRemaining(
                      session.started_at,
                      session.test_schedules?.duration_minutes || 60,
                      session.time_remaining_seconds
                    )

                    const elapsedMins = calculateTimeElapsed(session.started_at)

                    return (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="font-medium">{session.profiles?.full_name || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {session.profiles?.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {session.test_schedules?.title || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {session.test_schedules?.duration_minutes || 60} menit
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <Progress value={progressPercent} className="w-full h-2" />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {currentQuestion}/{questionCount} soal ({Math.round(progressPercent)}
                              %)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={
                                remainingMins < 5
                                  ? "destructive"
                                  : remainingMins < 15
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {remainingMins} menit tersisa
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Berjalan {elapsedMins} menit
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (session.strike_count || 0) >= 3
                                ? "destructive"
                                : (session.strike_count || 0) >= 2
                                  ? "secondary"
                                  : (session.strike_count || 0) > 0
                                    ? "outline"
                                    : "outline"
                            }
                          >
                            {session.strike_count || 0} strike
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={session.status === "active" ? "default" : "secondary"}>
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleViewDetails(session)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Lihat Detail
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSession(session)
                                  setShowPersonalMessage(true)
                                }}
                              >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Kirim Pesan
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePause(session)}>
                                <Pause className="mr-2 h-4 w-4" />
                                Simpan Timer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setSelectedSession(session)
                                  setShowForceStop(true)
                                }}
                              >
                                <StopCircle className="mr-2 h-4 w-4" />
                                Hentikan Paksa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">
                Tidak ada peserta yang sedang mengerjakan test
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Message Dialog */}
      <Dialog open={showGlobalMessage} onOpenChange={setShowGlobalMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Broadcast Message ke Semua Peserta
            </DialogTitle>
            <DialogDescription>
              Pesan akan dikirim ke {activeSessions.length} peserta yang sedang aktif
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Tulis pesan untuk semua peserta..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Pesan akan muncul sebagai notifikasi di layar test peserta
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGlobalMessage(false)
                setMessageText("")
              }}
            >
              Batal
            </Button>
            <Button onClick={handleSendGlobalMessage} disabled={sendingMessage}>
              {sendingMessage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Kirim ke Semua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personal Message Dialog */}
      <Dialog open={showPersonalMessage} onOpenChange={setShowPersonalMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Kirim Pesan Personal
            </DialogTitle>
            <DialogDescription>
              Kirim pesan ke {selectedSession?.profiles?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Tulis pesan untuk peserta..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Hanya peserta ini yang akan melihat pesan
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPersonalMessage(false)
                setMessageText("")
              }}
            >
              Batal
            </Button>
            <Button onClick={handleSendPersonalMessage} disabled={sendingMessage}>
              {sendingMessage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Kirim Pesan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Sesi Test</DialogTitle>
            <DialogDescription>
              Informasi lengkap dan log aktivitas peserta
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Peserta</p>
                  <p className="text-sm font-semibold">{selectedSession.profiles?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedSession.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Test</p>
                  <p className="text-sm font-semibold">{selectedSession.test_schedules?.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mulai</p>
                  <p className="text-sm">
                    {new Date(selectedSession.started_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Strikes</p>
                  <Badge variant="destructive">{selectedSession.strike_count || 0}</Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Log Aktivitas Mencurigakan
                </h4>
                {activityLogs.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 border rounded-lg bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">
                              {formatActivityType(log.activity_type)}
                            </Badge>
                            {log.action_taken && (
                              <Badge variant="outline" className="text-xs">
                                {log.action_taken}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(log.created_at).toLocaleString("id-ID")}
                          </p>
                          {log.details && (
                            <p className="text-xs mt-1">{JSON.stringify(log.details)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada aktivitas mencurigakan</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Force Stop Alert Dialog */}
      <AlertDialog open={showForceStop} onOpenChange={setShowForceStop}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hentikan Sesi Paksa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghentikan sesi test{" "}
              <strong>{selectedSession?.profiles?.full_name}</strong> secara paksa. Sesi akan
              ditandai sebagai "force_submitted" dan tidak dapat dilanjutkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceStop}
              disabled={actionLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, Hentikan Paksa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}