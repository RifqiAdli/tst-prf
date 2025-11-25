import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function QuestionsPage() {
  const supabase = await createClient()

  const { data: questions } = await supabase
    .from("questions")
    .select("*, question_categories(name)")
    .order("created_at", { ascending: false })

  const { data: categories } = await supabase.from("question_categories").select("*, questions(id)")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Soal</h1>
          <p className="text-muted-foreground">Kelola soal-soal preferensi</p>
        </div>
        <Button asChild>
          <Link href="/admin/questions/create">
            <Plus className="mr-2 h-4 w-4" />
            Tambah Soal
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {categories?.map((cat) => (
          <Card key={cat.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{cat.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cat.questions?.length || 0}</div>
              <p className="text-xs text-muted-foreground">soal tersedia</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Soal</CardTitle>
          <CardDescription>Total {questions?.length || 0} soal</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pertanyaan</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Dibuat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions?.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-md truncate">{q.question_text}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{q.question_categories?.name}</Badge>
                  </TableCell>
                  <TableCell>{q.question_type}</TableCell>
                  <TableCell>{new Date(q.created_at).toLocaleDateString("id-ID")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
