import ReviewClient from "./ReviewClient";

export default function ReviewPage() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-14">
        <div className="relative overflow-hidden rounded-lg border border-[#e4e4e7] bg-[#ffffff] p-7 sm:p-10 shadow-lg">
          <header className="relative mb-8">
            <h1 className="text-center text-3xl font-bold tracking-tight text-[#09090b]">
              Review &amp; Export
            </h1>
            <p className="mt-2 text-center text-sm text-[#8f8798]">
              Edit any cell, then download as Excel
            </p>
          </header>

          <ReviewClient />
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
