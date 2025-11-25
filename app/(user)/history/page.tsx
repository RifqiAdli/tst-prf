import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileQuestion, Clock, Trophy, Eye } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { id } from "date-fns/locale"

export default async function HistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: results } = await supabase
    .from("test_results")
    .select(`
      *,
      schedule:test_schedules(title, description)
    `)
    .eq("user_id", user?.id)
    .order("submitted_at", { ascending: false })

  // Calculate stats
  const totalTests = results?.length || 0
  const averageScore =
    results && results.length > 0 ? results.reduce((acc, r) => acc + (r.score || 0), 0) / results.length : 0
  const highestScore = results && results.length > 0 ? Math.max(...results.map((r) => r.score || 0)) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Riwayat Test</h1>
        <p className="text-muted-foreground">Daftar semua test yang telah Anda selesaikan</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileQuestion className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Test</p>
                <p className="text-2xl font-bold">{totalTests}</p>
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
                <p className="text-sm text-muted-foreground">Rata-rata Skor</p>
                <p className="text-2xl font-bold">{averageScore.toFixed(1)}%</p>
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
                <p className="text-sm text-muted-foreground">Skor Tertinggi</p>
                <p className="text-2xl font-bold">{highestScore.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Semua Hasil</CardTitle>
          <CardDescription>Hasil test lengkap dengan skor dan waktu pengerjaan</CardDescription>
        </CardHeader>
        <CardContent>
          {!results || results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Belum ada riwayat test</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-center">Dijawab</TableHead>
                  <TableHead className="text-center">Benar</TableHead>
                  <TableHead className="text-center">Skor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">{result.schedule?.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(result.submitted_at), "dd MMM yyyy, HH:mm", { locale: id })}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.answered_questions}/{result.total_questions}
                    </TableCell>
                    <TableCell className="text-center text-green-600">{result.correct_answers || 0}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-primary">{result.score?.toFixed(0) || 0}%</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={result.status === "analyzed" ? "default" : "secondary"}>
                        {result.status === "analyzed" ? "Dianalisis" : "Selesai"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/test/${result.schedule_id}/result`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
