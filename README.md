# Ai-QA-Automation

A web portal for uploading QA automation documents. The frontend provides a polished file-upload experience for CSV, PDF, and DOCX files, with server-side validation and local storage ready for downstream QA processing.

## Features

- **File Portal UI** — Drag-and-drop or browse to upload files
- **Supported formats** — `.csv`, `.pdf`, `.docx` only
- **Large file support** — Up to **1 GB** per file
- **Validation** — Client and server checks for file type and size
- **Auto-dismiss notifications** — Success and error messages close after 5 seconds
- **Secure storage** — Uploaded files saved to `frontend/uploads/` (not committed to git)

## Project Structure

```
Ai-QA-Automation/
└── frontend/          # Next.js app (App Router)
    ├── src/
    │   ├── app/       # Pages and API routes
    │   ├── components/
    │   └── lib/
    └── uploads/       # Uploaded files (created at runtime)
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [npm](https://www.npmjs.com/) (included with Node.js)
- [Git](https://git-scm.com/)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/JamesKunn/Ai-QA-Automation.git
cd Ai-QA-Automation
```

### 2. Install dependencies

```bash
cd frontend
npm install
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Upload a file

1. On the home page, drag a file into the drop zone or click to browse.
2. Confirm the file appears in the selected-files list (invalid types or oversized files show an error).
3. Click **Upload files**.
4. A success or error notification appears and auto-dismisses after 5 seconds.
5. Uploaded files are stored in `frontend/uploads/` with a timestamp prefix.

## Available Scripts

Run these from the `frontend` directory:

| Command         | Description                    |
|----------------|--------------------------------|
| `npm run dev`  | Start development server       |
| `npm run build`| Create production build        |
| `npm run start`| Run production server          |
| `npm run lint` | Run ESLint                     |

## Production Build

```bash
cd frontend
npm run build
npm run start
```

The app runs at [http://localhost:3000](http://localhost:3000) by default.

## API

**`POST /api/upload`**

- Accepts `multipart/form-data` with one or more `files` fields
- Allowed types: CSV, PDF, DOCX
- Max size: 1 GB per file
- Returns JSON with upload status and saved file names

## Configuration

| Setting              | Location                                      | Default   |
|---------------------|-----------------------------------------------|-----------|
| Allowed file types  | `frontend/src/lib/allowed-file-types.ts`      | csv, pdf, docx |
| Max file size       | `frontend/src/lib/allowed-file-types.ts`      | 1 GB      |
| Upload directory    | `frontend/src/app/api/upload/route.ts`        | `frontend/uploads/` |
| Auto-close delay    | `frontend/src/components/FileUpload.tsx`      | 5 seconds |

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)

## License

Private project — all rights reserved.
