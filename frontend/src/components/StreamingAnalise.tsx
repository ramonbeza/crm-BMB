/**
 * Mostra texto JSON acumulando em tempo real enquanto Claude escreve.
 * Quando o stream termina e o JSON é parseado, renderiza o AnalisePanel estruturado.
 */
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { AnalisePanel } from "@/components/AnalisePanel";
import type { Analise } from "@/components/AnalisePanel";

interface Props {
  streamText: string;       // texto acumulado enquanto streama
  isStreaming: boolean;     // true enquanto recebe chunks
  analise: Analise | null;  // resultado parseado (disponível após stream completo)
}

export function StreamingAnalise({ streamText, isStreaming, analise }: Props) {
  const preRef = useRef<HTMLPreElement>(null);

  // Auto-scroll para o fim enquanto o texto cresce
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [streamText]);

  // Após stream completo e JSON parseado, mostra o painel estruturado
  if (!isStreaming && analise) {
    return <AnalisePanel analise={analise} />;
  }

  // Durante o stream: mostra texto aparecendo em tempo real
  if (isStreaming || streamText) {
    return (
      <div className="space-y-2">
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-primary-600">
            <Loader2 size={12} className="animate-spin" />
            Gerando análise jurídica...
          </div>
        )}
        <pre
          ref={preRef}
          className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-auto max-h-60 whitespace-pre-wrap font-mono leading-relaxed"
        >
          {streamText}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-primary-400 ml-0.5 animate-pulse align-middle" />
          )}
        </pre>
      </div>
    );
  }

  return null;
}
