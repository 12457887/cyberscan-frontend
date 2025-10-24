// app/api/generate-report/[id]/route.ts

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const { id } = params;

    // 🔹 Appelle ton backend (FastAPI)
    const res = await fetch(`${backendUrl}/generate-report/${id}`, {
      method: "GET",
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(errText, { status: res.status });
    }

    // 🔹 Transfère le PDF sans erreur CORS
    const blob = await res.blob();
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-${id}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
