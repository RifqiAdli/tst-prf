import type React from "react"
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(59,91,219,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,91,219,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="relative z-10 w-full max-w-md px-4">{children}</div>
    </div>
  )
}
