import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const ReceiptSchema = z.object({
  merchant: z.string().describe("Nombre del comercio o proveedor"),
  date: z.string().describe("Fecha de la transacción en formato YYYY-MM-DD"),
  currency: z.string().describe("Código de moneda detectado (USD, ARS, UYU, EUR, etc.)"),
  total: z.number().describe("Monto total del ticket"),
  subtotal: z.number().optional().describe("Subtotal antes de impuestos"),
  tax: z.number().optional().describe("Monto de impuestos/IVA"),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().optional(),
        unitPrice: z.number().optional(),
        total: z.number(),
      })
    )
    .describe("Lista de items del ticket"),
  category: z
    .string()
    .describe(
      "Categoría sugerida: food, transport, housing, health, entertainment, education, clothing, subscriptions, services, other-expense"
    ),
  confidence: z.number().min(0).max(1).describe("Nivel de confianza del análisis (0-1)"),
  notes: z.string().optional().describe("Observaciones adicionales sobre el ticket"),
});

export type ReceiptData = z.infer<typeof ReceiptSchema>;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY no configurada. Agregala en Configuración > Integración IA." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "No se recibió ninguna imagen" }, { status: 400 });
    }

    const imageBytes = await imageFile.arrayBuffer();
    const imageBase64 = Buffer.from(imageBytes).toString("base64");
    const mimeType = imageFile.type || "image/jpeg";

    const googleAI = createGoogleGenerativeAI({ apiKey });
    const { object } = await generateObject({
      model: googleAI("gemini-2.5-flash"),
      schema: ReceiptSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: `data:${mimeType};base64,${imageBase64}`,
            },
            {
              type: "text",
              text: `Analizá este ticket/factura de compra y extraé la información en formato estructurado.

              Instrucciones:
              - Detectá la moneda por los símbolos o contexto ($ puede ser ARS, UYU o USD según el país/contexto)
              - Si ves "ARS", "pesos argentinos" o precios típicos de Argentina, usá ARS
              - Si ves "UYU", "pesos uruguayos" o precios típicos de Uruguay, usá UYU
              - Si ves "USD", "dólares", "U$S" o "US$", usá USD
              - La fecha debe estar en formato YYYY-MM-DD (si no hay año, usá el año actual 2025)
              - Extraé todos los items del ticket
              - Asigná la categoría más apropiada basándote en el tipo de comercio
              - El campo confidence debe reflejar qué tan legible y completo está el ticket`,
            },
          ],
        },
      ],
    });

    return NextResponse.json({ success: true, data: object });
  } catch (error) {
    console.error("Error scanning receipt:", error);

    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes("API_KEY") || msg.includes("API key")) {
      return NextResponse.json(
        { error: "API key de Gemini inválida. Verificá tu configuración." },
        { status: 401 }
      );
    }
    if (msg.includes("quota") || msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("RetryError")) {
      return NextResponse.json(
        { error: "Quota de Gemini agotada. Esperá unos segundos y volvé a intentar." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Error al analizar el ticket. Intentá con una foto más clara." },
      { status: 500 }
    );
  }
}
