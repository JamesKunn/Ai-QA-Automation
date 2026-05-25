import FileUpload from "@/components/FileUpload";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 sm:py-14">
        <div
          className="relative overflow-hidden rounded-3xl p-[1px] shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_60px_rgba(47,18,61,0.35)]"
          style={{
            background:
              "linear-gradient(180deg, rgba(220,201,235,0.7) 0%, rgba(201,179,217,0.55) 46%, rgba(201,179,217,0.4) 100%)",
          }}
        >
          <div
            className="relative overflow-hidden rounded-[calc(1rem+1px)] p-7 backdrop-blur-xl sm:p-10"
            style={{
              background:
                "linear-gradient(180deg, rgba(58,28,72,0.92) 0%, rgba(47,18,61,0.94) 46%, rgba(32,20,38,0.96) 100%)",
              boxShadow:
                "0 0 0 1px rgba(220,201,235,0.35) inset, 0 0 0 1px rgba(201,179,217,0.2), 0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(47,18,61,0.35)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(201,179,217,0.08) 0%, rgba(47,18,61,0.12) 46%, rgba(17,12,20,0.15) 100%)",
              }}
            />

            <header className="relative">
              <div className="mb-8">
                <h1
                  className="text-center text-4xl font-bold tracking-tight sm:text-5xl"
                  style={{
                    color: "#f5f0fa",
                    textShadow:
                      "0 1px 2px rgba(0,0,0,0.4), 0 0 20px rgba(201,179,217,0.25)",
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
