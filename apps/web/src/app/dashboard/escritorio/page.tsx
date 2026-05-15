import { OfficeCanvasShell } from '@/components/office/OfficeCanvasShell';

export default function EscritorioPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-neutral-800 bg-neutral-950 px-4 py-2">
        <h1 className="text-sm text-neutral-400">Escritório virtual (mock)</h1>
      </div>
      <div className="flex-1 bg-neutral-950">
        <OfficeCanvasShell />
      </div>
    </div>
  );
}
