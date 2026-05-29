import FileUpload from "@/components/FileUpload";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 sm:py-14">
        <div className="relative overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#ffffff] p-7 sm:p-10 shadow-lg">
          <header className="relative">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[#09090b]">
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#8b5cf6] mb-1.5">AI-QA Automation Platform</span>
                <span className="block">Upload PRD</span>
              </h1>
              <p className="mt-2 text-sm text-[#71717a]">
                 For automated Epics generation using AI
              </p>
            </div>
          </header>

          <FileUpload />
        </div>
        <div className="mt-8 flex justify-center">
          <img
            src="/agentgeniuslogo.png"
            alt="Powered by AgentGenius.ai"
            className="h-16 w-auto opacity-70 hover:opacity-100 transition-opacity duration-200"
          />
        </div>
      </main>
    </div>
  );
}
