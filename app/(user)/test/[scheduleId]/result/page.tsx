import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Clock, FileQuestion, ArrowRight, Home, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { id } from "date-fns/locale"

interface PageProps {
  params: Promise<{ scheduleId: string }>
  searchParams: Promise<{ forced?: string }>
}

export default async function TestResultPage({ params, searchParams }: PageProps) {
  const { scheduleId } = await params
  const { forced } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: result } = await supabase
    .from("test_results")
    .select(`
      *,
      schedule:test_schedules(title, description)
    `)
    .eq("schedule_id", scheduleId)
    .eq("user_id", user.id)
    .single()

  if (!result) {
    redirect("/schedules")
  }

  const categoryScores = result.category_scores as Record<string, number> | null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        {forced ? (
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
        ) : (
          <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        )}
        <h1 className="text-2xl font-bold">{forced ? "Test Dihentikan" : "Test Selesai!"}</h1>
        <p className="text-muted-foreground">{result.schedule?.title}</p>
        {forced && <Badge variant="destructive">Dihentikan karena pelanggaran</Badge>}
      </div>

      {/* Score Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <div className="text-6xl font-bold text-primary mb-2">{result.score?.toFixed(0) || 0}%</div>
            <p className="text-muted-foreground">Skor Anda</p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                <CheckCircle className="h-5 w-5" />
                <span className="text-2xl font-bold">{result.correct_answers || 0}</span>
              </div>
              <p className="text-sm text-muted-foreground">Benar</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center justify-center gap-2 text-destructive mb-1">
                <XCircle className="h-5 w-5" />
                <span className="text-2xl font-bold">{result.answered_questions - (result.correct_answers || 0)}</span>
              </div>
              <p className="text-sm text-muted-foreground">Salah</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <FileQuestion className="h-5 w-5" />
                <span className="text-2xl font-bold">{result.total_questions - result.answered_questions}</span>
              </div>
              <p className="text-sm text-muted-foreground">Tidak Dijawab</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {categoryScores && Object.keys(categoryScores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skor per Kategori</CardTitle>
            <CardDescription>Breakdown skor berdasarkan kategori soal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(categoryScores).map(([category, score]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{category}</span>
                  <span className="font-medium">{score.toFixed(0)}%</span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Waktu Selesai:</span>
              <span>{format(new Date(result.submitted_at), "dd MMM yyyy, HH:mm", { locale: id })}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total Soal:</span>
              <span>{result.total_questions}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis Placeholder */}
      {result.ai_analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Analisis AI</CardTitle>
            <CardDescription>Insight berdasarkan jawaban Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{result.ai_analysis}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild>
          <Link href="/history">
            Lihat Riwayat
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
