import FileUpload from "@/components/FileUpload";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 sm:py-14">
        <div
          className="relative overflow-hidden rounded-3xl p-[1px] shadow-[0_12px_48px_rgba(0,0,0,0.75),0_0_40px_rgba(124,58,237,0.14)]"
          style={{
            background:
              "linear-gradient(180deg, rgba(167,139,250,0.28) 0%, rgba(88,28,135,0.22) 50%, rgba(18,12,26,0.55) 100%)",
          }}
        >
          <div
            className="relative overflow-hidden rounded-[calc(1rem+1px)] p-7 backdrop-blur-xl sm:p-10"
            style={{
              background:
                "linear-gradient(180deg, rgba(22,18,30,0.98) 0%, rgba(16,12,22,0.99) 55%, rgba(18,14,26,0.99) 100%)",
              boxShadow:
                "0 0 0 1px rgba(196,181,253,0.22) inset, 0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.65), 0 0 36px rgba(124,58,237,0.1)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(167,139,250,0.06) 0%, transparent 40%, rgba(28,14,38,0.08) 100%)",
              }}
            />

            <header className="relative">
              <div className="mb-8">
                <h1
                  className="text-center text-4xl font-bold tracking-tight sm:text-5xl"
                  style={{
                    color: "#f5f3f8",
                    textShadow:
                      "0 1px 3px rgba(0,0,0,0.6), 0 0 24px rgba(167,139,250,0.15)",
                  }}
                >
                  <span className="block">Ai-QA-Automation</span>
                  <span className="block">File Portal</span>
                </h1>
              </div>
            </header>

            <FileUpload />
          </div>
        </div>
      </main>
    </div>
  );
}
