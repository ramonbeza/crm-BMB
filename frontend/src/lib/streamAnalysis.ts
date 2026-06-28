/**
 * Streams a legal analysis (análise jurídica) from the backend SSE endpoint.
 * Calls onToken for each text chunk, onDone when complete.
 */
export async function streamAnalysis(
  file: File,
  accessToken: string | null,
  onToken: (chunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const base = import.meta.env.VITE_API_URL ?? "/api/v1";
  const fd = new FormData();
  fd.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${base}/properties/analyze-matricula-stream`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: fd,
    });
  } catch {
    onError("Não foi possível conectar ao servidor.");
    return;
  }

  if (!response.ok) {
    onError("Erro ao iniciar análise. Tente novamente.");
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError("Streaming não suportado neste navegador.");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        onDone(fullText);
        return;
      }
      try {
        const { text, error } = JSON.parse(payload);
        if (error) { onError(error); return; }
        if (text) {
          fullText += text;
          onToken(text);
        }
      } catch {
        // malformed chunk, ignore
      }
    }
  }

  onDone(fullText);
}
