"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@supabase/ssr"
import { Plus, Trash2 } from "lucide-react"

export default function SettingsPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [newCategory, setNewCategory] = useState("")
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    const { data } = await supabase.from("question_categories").select("*").order("name")
    if (data) setCategories(data)
  }

  async function addCategory() {
    if (!newCategory.trim()) return
    setLoading(true)
    await supabase.from("question_categories").insert({ name: newCategory.trim() })
    setNewCategory("")
    await loadCategories()
    setLoading(false)
  }

  async function deleteCategory(id: string) {
    if (!confirm("Yakin ingin menghapus kategori ini?")) return
    await supabase.from("question_categories").delete().eq("id", id)
    await loadCategories()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-muted-foreground">Konfigurasi sistem test</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kategori Soal</CardTitle>
          <CardDescription>Kelola kategori untuk klasifikasi soal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nama kategori baru"
            />
            <Button onClick={addCategory} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Kategori</TableHead>
                <TableHead className="w-20">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>{cat.name}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
