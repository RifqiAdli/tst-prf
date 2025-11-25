import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ClipboardCheck, Shield, Clock, BarChart3, ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(59,91,219,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,91,219,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Header */}
      <header className="relative z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">PreferTest</span>
          </div>
          <Button asChild>
            <Link href="/login">
              Masuk
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-24 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Dilengkapi Sistem Anti-Kecurangan
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-balance">
            Platform Test Preferensi
            <br />
            <span className="text-primary">Modern & Aman</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty">
            Solusi lengkap untuk menyelenggarakan test preferensi online dengan fitur monitoring real-time dan analisis
            AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/login">
                Mulai Sekarang
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">Pelajari Fitur</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Fitur Unggulan</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Semua yang Anda butuhkan untuk menyelenggarakan test preferensi yang profesional
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Shield,
                title: "Anti-Kecurangan",
                description: "Deteksi tab switching, fullscreen exit, dan aktivitas mencurigakan lainnya",
              },
              {
                icon: Clock,
                title: "Real-time Monitoring",
                description: "Pantau progress peserta secara langsung dengan update real-time",
              },
              {
                icon: BarChart3,
                title: "Analisis AI",
                description: "Analisis hasil test otomatis dengan rekomendasi yang dipersonalisasi",
              },
              {
                icon: ClipboardCheck,
                title: "Multi Tipe Soal",
                description: "Pilihan ganda, multi-select, dan menjodohkan dalam satu platform",
              },
            ].map((feature, index) => (
              <div key={index} className="bg-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} PreferTest. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
