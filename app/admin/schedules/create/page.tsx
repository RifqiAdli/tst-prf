"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Minus, Info, Calculator, Copy, Check, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

export default function ScheduleCreateForm() {
  const supabase = createClient()
  
  // Helper function to format datetime for datetime-local input
  const formatDateTimeLocal = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    // Format: YYYY-MM-DDTHH:mm
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    duration_minutes: 60,
    question_selection_mode: "random",
    total_questions: 30,
    shuffle_questions: true,
    shuffle_options: true,
    max_strikes: 3,
    is_published: false
  })

  const [categories, setCategories] = useState([])
  const [categoryDistribution, setCategoryDistribution] = useState({})
  const [availableQuestions, setAvailableQuestions] = useState({})
  const [loading, setLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [generatedToken, setGeneratedToken] = useState("")
  const [users, setUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState("")

  // Load categories dan hitung jumlah soal tersedia
  useEffect(() => {
    async function loadCategories() {
      const { data: cats } = await supabase
        .from("question_categories")
        .select("*")
        .order("name")

      if (cats) {
        setCategories(cats)
        
        // Hitung jumlah soal per kategori
        const counts = {}
        for (const cat of cats) {
          const { count } = await supabase
            .from("questions")
            .select("*", { count: 'exact', head: true })
            .eq("category_id", cat.id)
            .eq("is_active", true)
          
          counts[cat.id] = count || 0
        }
        setAvailableQuestions(counts)
      }
    }

    async function loadUsers() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "user")
        .eq("is_active", true)
        .order("full_name")
      
      if (data) {
        setUsers(data)
      }
    }

    loadCategories()
    loadUsers()
  }, [])

  // Hitung total soal dari distribusi kategori
  const totalFromCategories = Object.values(categoryDistribution).reduce(
    (sum, val) => sum + (parseInt(val) || 0),
    0
  )

  const handleCategoryCountChange = (categoryId, value) => {
    const numValue = parseInt(value) || 0
    const maxAvailable = availableQuestions[categoryId] || 0
    
    setCategoryDistribution(prev => ({
      ...prev,
      [categoryId]: Math.min(numValue, maxAvailable)
    }))
  }

  const handleModeChange = (mode) => {
    setFormData(prev => ({ ...prev, question_selection_mode: mode }))
    if (mode === "random") {
      setCategoryDistribution({})
    }
  }

  const distributeEvenly = () => {
    const activeCategories = categories.filter(
      cat => availableQuestions[cat.id] > 0
    )
    
    if (activeCategories.length === 0) return

    const perCategory = Math.floor(formData.total_questions / activeCategories.length)
    const remainder = formData.total_questions % activeCategories.length
    
    const distribution = {}
    activeCategories.forEach((cat, idx) => {
      const count = perCategory + (idx < remainder ? 1 : 0)
      const maxAvailable = availableQuestions[cat.id]
      distribution[cat.id] = Math.min(count, maxAvailable)
    })
    
    setCategoryDistribution(distribution)
  }

  const copyToken = () => {
    navigator.clipboard.writeText(generatedToken)
  }

  const toggleUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id))
    }
  }

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSubmit = async () => {
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Generate token
      const token = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Validasi
      if (formData.question_selection_mode === "by_category") {
        if (totalFromCategories !== formData.total_questions) {
          alert(`Total soal dari kategori (${totalFromCategories}) harus sama dengan target (${formData.total_questions})`)
          setLoading(false)
          return
        }
      }

      // Convert datetime-local to ISO string with timezone
      // datetime-local gives us "2024-01-15T13:25" (no timezone)
      // We need to treat it as local time and convert to ISO
      const startDateTime = new Date(formData.start_time)
      const endDateTime = new Date(formData.end_time)
      
      // Convert to ISO string (will include timezone offset)
      const start_time = startDateTime.toISOString()
      const end_time = endDateTime.toISOString()

      // Create schedule
      const { data: schedule, error: scheduleError } = await supabase
        .from("test_schedules")
        .insert({
          title: formData.title,
          description: formData.description,
          start_time,
          end_time,
          duration_minutes: formData.duration_minutes,
          question_count: formData.total_questions,
          question_selection_mode: formData.question_selection_mode,
          shuffle_questions: formData.shuffle_questions,
          shuffle_options: formData.shuffle_options,
          max_strikes: formData.max_strikes,
          is_published: formData.is_published,
          token,
          created_by: user.id
        })
        .select()
        .single()

      if (scheduleError) throw scheduleError

      // Jika mode by_category, simpan distribusi
      if (formData.question_selection_mode === "by_category") {
        const distributions = Object.entries(categoryDistribution)
          .filter(([_, count]) => count > 0)
          .map(([categoryId, count]) => ({
            schedule_id: schedule.id,
            category_id: categoryId,
            question_count: count
          }))

        const { error: distError } = await supabase
          .from("schedule_category_distribution")
          .insert(distributions)

        if (distError) throw distError
      }

      // Ambil soal dan tambahkan ke schedule_questions
      let selectedQuestions = []

      if (formData.question_selection_mode === "by_category") {
        // Ambil soal per kategori sesuai distribusi
        for (const [categoryId, count] of Object.entries(categoryDistribution)) {
          if (count > 0) {
            const { data: questions } = await supabase
              .from("questions")
              .select("id")
              .eq("category_id", categoryId)
              .eq("is_active", true)
              .limit(count)

            if (questions) {
              selectedQuestions.push(...questions)
            }
          }
        }
      } else {
        // Mode random: ambil soal acak dari semua kategori
        const { data: questions } = await supabase
          .from("questions")
          .select("id")
          .eq("is_active", true)
          .limit(formData.total_questions)

        selectedQuestions = questions || []
      }

      // Shuffle dan insert ke schedule_questions
      const shuffled = formData.shuffle_questions
        ? selectedQuestions.sort(() => Math.random() - 0.5)
        : selectedQuestions

      const scheduleQuestions = shuffled.map((q, idx) => ({
        schedule_id: schedule.id,
        question_id: q.id,
        order_index: idx
      }))

      const { error: sqError } = await supabase
        .from("schedule_questions")
        .insert(scheduleQuestions)

      if (sqError) throw sqError

      // Add participants
      if (selectedUsers.length > 0) {
        const participants = selectedUsers.map(userId => ({
          schedule_id: schedule.id,
          user_id: userId,
          status: 'assigned'
        }))

        const { error: participantError } = await supabase
          .from("schedule_participants")
          .insert(participants)

        if (participantError) throw participantError
      }

      // Show success modal with token
      setGeneratedToken(token)
      setShowSuccessModal(true)
    } catch (error) {
      console.error(error)
      alert("Terjadi kesalahan: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Success Modal with Token */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Berhasil Dibuat! 🎉</DialogTitle>
            <DialogDescription>
              Simpan token ini untuk dibagikan kepada peserta test
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-6 bg-primary/5 rounded-lg border-2 border-primary/20">
              <Label className="text-sm text-muted-foreground mb-2 block">Token Test:</Label>
              <div className="text-4xl font-bold text-center tracking-widest font-mono text-primary">
                {generatedToken}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={copyToken} 
                className="flex-1"
                variant="outline"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Token
              </Button>
              <Button 
                onClick={() => {
                  setShowSuccessModal(false)
                  window.location.href = "/admin/schedules"
                }}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Selesai
              </Button>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Token ini diperlukan peserta untuk memulai test. Pastikan untuk menyimpannya dengan aman.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Peserta Test</CardTitle>
          <CardDescription>Pilih user yang akan mengikuti test ini</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Total Dipilih: <Badge>{selectedUsers.length}</Badge></Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAllUsers}
            >
              <Users className="h-4 w-4 mr-2" />
              {selectedUsers.length === filteredUsers.length ? "Hapus Semua" : "Pilih Semua"}
            </Button>
          </div>

          <div>
            <Input
              placeholder="Cari berdasarkan nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-lg p-4">
            <div className="space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {searchQuery ? "Tidak ada user yang cocok" : "Belum ada user terdaftar"}
                </p>
              ) : (
                filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => toggleUser(user.id)}
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {selectedUsers.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Pilih minimal 1 peserta untuk mengikuti test ini
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Dasar</CardTitle>
          <CardDescription>Detail jadwal test</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Judul Test</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Waktu Mulai</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="end_time">Waktu Selesai</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="duration">Durasi (menit)</Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Soal</CardTitle>
          <CardDescription>Atur bagaimana soal dipilih untuk test ini</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Mode Pemilihan Soal</Label>
            <RadioGroup 
              value={formData.question_selection_mode} 
              onValueChange={handleModeChange}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="random" id="random" />
                <Label htmlFor="random" className="font-normal cursor-pointer">
                  Random - Pilih soal acak dari semua kategori
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="by_category" id="by_category" />
                <Label htmlFor="by_category" className="font-normal cursor-pointer">
                  Per Kategori - Atur jumlah soal dari setiap kategori
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="total_questions">Total Soal</Label>
            <Input
              id="total_questions"
              type="number"
              value={formData.total_questions}
              onChange={(e) => setFormData(prev => ({ ...prev, total_questions: parseInt(e.target.value) }))}
              required
            />
          </div>

          {formData.question_selection_mode === "by_category" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Distribusi Per Kategori</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={distributeEvenly}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Bagi Rata
                </Button>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Total dari kategori: <strong>{totalFromCategories}</strong> / {formData.total_questions} soal
                  {totalFromCategories !== formData.total_questions && (
                    <span className="text-destructive ml-2">
                      (Harus sama dengan target!)
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {categories.map(category => (
                  <div key={category.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{category.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {availableQuestions[category.id] || 0} soal tersedia
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCategoryCountChange(
                          category.id,
                          Math.max(0, (categoryDistribution[category.id] || 0) - 1)
                        )}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={categoryDistribution[category.id] || 0}
                        onChange={(e) => handleCategoryCountChange(category.id, e.target.value)}
                        className="w-20 text-center"
                        min={0}
                        max={availableQuestions[category.id] || 0}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCategoryCountChange(
                          category.id,
                          (categoryDistribution[category.id] || 0) + 1
                        )}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="shuffle_questions">Acak Urutan Soal</Label>
              <Switch
                id="shuffle_questions"
                checked={formData.shuffle_questions}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, shuffle_questions: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="shuffle_options">Acak Urutan Opsi Jawaban</Label>
              <Switch
                id="shuffle_options"
                checked={formData.shuffle_options}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, shuffle_options: checked }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Anti-Cheat</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="max_strikes">Maksimal Pelanggaran</Label>
            <Input
              id="max_strikes"
              type="number"
              value={formData.max_strikes}
              onChange={(e) => setFormData(prev => ({ ...prev, max_strikes: parseInt(e.target.value) }))}
              min={1}
              max={10}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Test akan otomatis di-submit jika pelanggaran mencapai batas ini
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publikasi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_published">Publikasikan Jadwal</Label>
              <p className="text-sm text-muted-foreground">
                Jadwal yang dipublikasikan dapat dilihat oleh peserta
              </p>
            </div>
            <Switch
              id="is_published"
              checked={formData.is_published}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button 
          onClick={handleSubmit} 
          disabled={loading || selectedUsers.length === 0} 
          className="flex-1"
        >
          {loading ? "Membuat..." : "Buat Jadwal"}
        </Button>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Batal
        </Button>
      </div>
    </div>
  )
}