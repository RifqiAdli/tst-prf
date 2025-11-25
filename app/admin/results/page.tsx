import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ExportResultsButton } from "@/components/admin/export-results-button"

export default async function ResultsPage() {
  const supabase = await createClient()

  // PERBAIKAN: Query sesuai dengan schema database
  const { data: results, error } = await supabase
    .from("test_results")
    .select(`
      id,
      score,
      total_questions,
      answered_questions,
      correct_answers,
      time_spent_seconds,
      category_scores,
      submitted_at,
      status,
      profiles:user_id (
        full_name,
        email
      ),
      test_schedules:schedule_id (
        title
      )
    `)
    .order("submitted_at", { ascending: false })

  if (error) {
    console.error("Error fetching results:", error)
  }

  // Helper function untuk mendapatkan kategori dominan dari category_scores
  const getDominantCategory = (categoryScores: any) => {
    if (!categoryScores || typeof categoryScores !== 'object') return "-"
    
    let maxScore = -1
    let dominantCategory = "-"
    
    Object.entries(categoryScores).forEach(([category, score]) => {
      if (typeof score === 'number' && score > maxScore) {
        maxScore = score
        dominantCategory = category
      }
    })
    
    return dominantCategory
  }

  // Format waktu dari detik ke menit:detik
  const formatTimeSpent = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hasil Test</h1>
          <p className="text-muted-foreground">Rekap semua hasil test peserta</p>
        </div>
        <ExportResultsButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Hasil</CardTitle>
          <CardDescription>Total {results?.length || 0} hasil</CardDescription>
        </CardHeader>
        <CardContent>
          {results && results.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Skor</TableHead>
                  <TableHead className="text-center">Benar/Total</TableHead>
                  <TableHead>Kategori Dominan</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <div className="font-medium">
                        {result.profiles?.full_name || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {result.profiles?.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.test_schedules?.title || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {result.score ? `${result.score}%` : "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium">
                        {result.correct_answers || 0}/{result.total_questions || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getDominantCategory(result.category_scores)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {result.time_spent_seconds 
                          ? formatTimeSpent(result.time_spent_seconds)
                          : "-"
                        }
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          result.status === 'analyzed' 
                            ? 'default' 
                            : result.status === 'reviewed'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {result.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(result.submitted_at).toLocaleDateString("id-ID", {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(result.submitted_at).toLocaleTimeString("id-ID", {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              Belum ada hasil test yang tersedia
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}