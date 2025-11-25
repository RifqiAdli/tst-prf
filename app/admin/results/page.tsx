import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ExportResultsButton } from "@/components/admin/export-results-button"

export default async function ResultsPage() {
  const supabase = await createClient()

  const { data: results } = await supabase
    .from("test_results")
    .select("*, profiles(full_name, email), test_schedules(name)")
    .order("created_at", { ascending: false })

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peserta</TableHead>
                <TableHead>Test</TableHead>
                <TableHead>Skor</TableHead>
                <TableHead>Kategori Dominan</TableHead>
                <TableHead>Waktu Selesai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results?.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>
                    <div className="font-medium">{result.profiles?.full_name || "-"}</div>
                    <div className="text-xs text-muted-foreground">{result.profiles?.email}</div>
                  </TableCell>
                  <TableCell>{result.test_schedules?.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{result.total_score}%</Badge>
                  </TableCell>
                  <TableCell>{result.dominant_category || "-"}</TableCell>
                  <TableCell>{new Date(result.created_at).toLocaleString("id-ID")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
