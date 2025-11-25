"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ExportResultsButtonProps {
  scheduleId?: string
}

export function ExportResultsButton({ scheduleId }: ExportResultsButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)

    try {
      const supabase = createClient()

      let query = supabase
        .from("test_results")
        .select(`
          *,
          profile:profiles(full_name, email),
          schedule:test_schedules(title)
        `)
        .order("created_at", { ascending: false })

      if (scheduleId) {
        query = query.eq("schedule_id", scheduleId)
      }

      const { data: results } = await query

      if (!results || results.length === 0) {
        alert("Tidak ada data untuk diexport")
        return
      }

      // Convert to CSV
      const headers = ["Nama", "Email", "Test", "Total Soal", "Dijawab", "Benar", "Skor", "Status", "Tanggal"]

      const rows = results.map((r) => [
        r.profile?.full_name || "-",
        r.profile?.email || "-",
        r.schedule?.title || "-",
        r.total_questions,
        r.answered_questions,
        r.correct_answers,
        r.score.toFixed(1) + "%",
        r.status,
        new Date(r.created_at).toLocaleDateString("id-ID"),
      ])

      const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

      // Download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `hasil-test-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
      alert("Gagal mengexport data")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      Export CSV
    </Button>
  )
}
