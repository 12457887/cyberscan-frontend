// app/api/generate-report/[id]/route.ts

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const { id } = params;

    // 🔹 Appelle ton backend (FastAPI)
    const headers: Record<string, string> = {};
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) headers['x-backend-api-key'] = backendKey;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("report_format") || searchParams.get("format") || "pdf";

    const res = await fetch(`${backendUrl}/generate-report/${id}?report_format=${format}`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(errText, { status: res.status });
    }

    let contentType = res.headers.get("content-type") || "application/octet-stream";
    const suggestedFilename =
      res.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") ||
      `rapport-${id}.${format === "xlsx" ? "xlsx" : format === "json" ? "json" : "pdf"}`;

    // 🔹 Transfère le fichier sans erreur CORS
    const blob = await res.blob();
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${suggestedFilename}"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
