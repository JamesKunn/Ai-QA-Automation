import FileUpload from "@/components/FileUpload";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-white/5">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <div className="leading-tight">
            <span className="block text-5xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
              Ai-QA-Automation
            </span>
            <span className="block text-5xl font-bold tracking-tight text-zinc-500 sm:text-6xl">
              File Portal
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 sm:py-12">
        <div className="rounded-2xl bg-white p-6 shadow-xl shadow-black/20 sm:p-10">
          <div className="mb-10">
            <h2 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
              Upload your files
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 sm:text-lg">
              Only CSV, PDF, and DOCX files are supported. Files are saved on
              the server for processing.
            </p>
          </div>
          <FileUpload />
        </div>
      </main>
    </div>
  );
}
