"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@supabase/ssr"
import { ArrowLeft, Plus, X, Upload, Download, FileJson } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const questionTypes = [
  { value: "multiple_choice", label: "Pilihan Ganda (Single)" },
  { value: "multiple_select", label: "Pilihan Ganda (Multiple)" },
  { value: "matching", label: "Mencocokkan" },
]

// Template JSON
const QUESTION_TEMPLATE = [
  {
    question: "Apa ibu kota Indonesia?",
    type: "multiple_choice",
    category_id: null,
    options: ["Jakarta", "Bandung", "Surabaya", "Medan"],
    correct_answer: 0,
    is_active: true
  },
  {
    question: "Pilih semua negara ASEAN:",
    type: "multiple_select",
    category_id: null,
    options: ["Indonesia", "Malaysia", "Thailand", "Jepang", "Korea"],
    correct_answers: [0, 1, 2],
    is_active: true
  }
]

export default function CreateQuestionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [questionType, setQuestionType] = useState("multiple_choice")
  const [options, setOptions] = useState<string[]>(["", "", "", ""])
  const [categories, setCategories] = useState<any[]>([])
  const [correctAnswer, setCorrectAnswer] = useState<string>("0")
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([])
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from("question_categories")
        .select("*")
        .order("name")

      if (error) {
        console.error("Error fetching categories:", error)
      } else if (data) {
        setCategories(data)
      }
    }

    fetchCategories()
  }, [])

  const addOption = () => setOptions([...options, ""])
  
  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
    setCorrectAnswers(correctAnswers.filter(i => i !== index))
  }
  
  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const toggleCorrectAnswer = (index: number) => {
    if (correctAnswers.includes(index)) {
      setCorrectAnswers(correctAnswers.filter(i => i !== index))
    } else {
      setCorrectAnswers([...correctAnswers, index])
    }
  }

  // Download template JSON
  function downloadTemplate() {
    const dataStr = JSON.stringify(QUESTION_TEMPLATE, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "template-soal.json"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("Template berhasil diunduh!")
  }

  // Import from JSON
  async function handleImport() {
    if (!importFile) {
      toast.error("Pilih file JSON terlebih dahulu")
      return
    }

    setImporting(true)

    try {
      const text = await importFile.text()
      const questions = JSON.parse(text)

      if (!Array.isArray(questions)) {
        toast.error("Format JSON tidak valid. Harus berupa array.")
        setImporting(false)
        return
      }

      // Validate structure
      const isValid = questions.every(q => 
        q.question && 
        q.type && 
        Array.isArray(q.options) &&
        (q.type === "multiple_choice" ? typeof q.correct_answer === "number" : true) &&
        (q.type === "multiple_select" ? Array.isArray(q.correct_answers) : true)
      )

      if (!isValid) {
        toast.error("Struktur data tidak sesuai template")
        setImporting(false)
        return
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Anda harus login")
        setImporting(false)
        return
      }

      // Insert questions
      const questionsToInsert = questions.map(q => ({
        question: q.question,
        type: q.type,
        category_id: q.category_id || null,
        options: q.options,
        correct_answer: q.correct_answer ?? null,
        correct_answers: q.correct_answers ?? null,
        is_active: q.is_active ?? true,
        created_by: user.id,
      }))

      const { data, error } = await supabase
        .from("questions")
        .insert(questionsToInsert)
        .select()

      if (error) {
        console.error("Import error:", error)
        toast.error(`Gagal import: ${error.message}`)
      } else {
        toast.success(`Berhasil import ${data.length} soal!`)
        setShowImportDialog(false)
        setImportFile(null)
        router.push("/admin/questions")
        router.refresh()
      }
    } catch (err) {
      console.error("Parse error:", err)
      toast.error("File JSON tidak valid")
    } finally {
      setImporting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const questionText = formData.get("question") as string
      const categoryId = formData.get("category_id") as string

      const validOptions = options.filter((o) => o.trim() !== "")
      if (validOptions.length < 2) {
        toast.error("Minimal harus ada 2 pilihan jawaban")
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Anda harus login")
        setLoading(false)
        return
      }

      let insertData: any = {
        question: questionText,
        type: questionType,
        category_id: categoryId || null,
        options: validOptions,
        is_active: true,
        created_by: user.id,
      }

      if (questionType === "multiple_choice") {
        insertData.correct_answer = parseInt(correctAnswer)
      } else if (questionType === "multiple_select") {
        if (correctAnswers.length === 0) {
          toast.error("Pilih minimal 1 jawaban yang benar")
          setLoading(false)
          return
        }
        insertData.correct_answers = correctAnswers
      }

      const { error } = await supabase
        .from("questions")
        .insert(insertData)

      if (error) {
        console.error("Insert error:", error)
        toast.error(`Gagal menyimpan: ${error.message}`)
      } else {
        toast.success("Soal berhasil disimpan!")
        router.push("/admin/questions")
        router.refresh()
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("Terjadi kesalahan")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/questions">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tambah Soal</h1>
            <p className="text-muted-foreground">Buat soal baru untuk bank soal</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import JSON
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Soal dari JSON</DialogTitle>
                <DialogDescription>
                  Upload file JSON dengan format sesuai template. Semua soal akan ditambahkan ke bank soal.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="json-file">File JSON</Label>
                  <Input
                    id="json-file"
                    type="file"
                    accept=".json"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload file JSON dengan struktur sesuai template
                  </p>
                </div>

                {importFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileJson className="h-4 w-4" />
                    <span className="text-sm">{importFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImportFile(null)}
                      className="ml-auto"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Format Template:</p>
                  <pre className="text-xs overflow-x-auto">
{`[
  {
    "question": "Pertanyaan...",
    "type": "multiple_choice",
    "category_id": null,
    "options": ["A", "B", "C"],
    "correct_answer": 0,
    "is_active": true
  }
]`}
                  </pre>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportDialog(false)
                    setImportFile(null)
                  }}
                >
                  Batal
                </Button>
                <Button onClick={handleImport} disabled={!importFile || importing}>
                  {importing ? "Importing..." : "Import"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form Soal</CardTitle>
          <CardDescription>Isi detail soal di bawah ini</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="question">Pertanyaan *</Label>
              <Textarea 
                id="question" 
                name="question" 
                required 
                rows={3}
                placeholder="Masukkan teks pertanyaan..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category_id">Kategori</Label>
                <Select name="category_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipe Soal *</Label>
                <Select value={questionType} onValueChange={setQuestionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Pilihan Jawaban *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah
                </Button>
              </div>
              
              {options.map((option, index) => (
                <div key={index} className="flex gap-2 items-center">
                  {questionType === "multiple_choice" ? (
                    <input
                      type="radio"
                      name="correct_single"
                      checked={correctAnswer === String(index)}
                      onChange={() => setCorrectAnswer(String(index))}
                      className="w-4 h-4"
                    />
                  ) : questionType === "multiple_select" ? (
                    <input
                      type="checkbox"
                      checked={correctAnswers.includes(index)}
                      onChange={() => toggleCorrectAnswer(index)}
                      className="w-4 h-4"
                    />
                  ) : null}
                  
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Pilihan ${index + 1}`}
                    required
                  />
                  
                  {options.length > 2 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeOption(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              <p className="text-xs text-muted-foreground">
                {questionType === "multiple_choice" 
                  ? "Pilih satu jawaban yang benar dengan radio button"
                  : "Centang semua jawaban yang benar dengan checkbox"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Soal"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/questions">Batal</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}