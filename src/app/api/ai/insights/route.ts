import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const InsightsSchema = z.object({
  summary: z.string().describe("Resumen ejecutivo de la situación financiera en 2-3 oraciones"),
  healthScore: z.number().min(0).max(100).describe("Puntuación de salud financiera del 0 al 100"),
  observations: z
    .array(
      z.object({
        type: z.enum(["positive", "warning", "critical", "info"]),
        title: z.string(),
        description: z.string(),
        category: z.enum(["income", "expense", "investment", "savings", "general"]),
      })
    )
    .describe("Lista de observaciones sobre las finanzas"),
  suggestions: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        title: z.string(),
        description: z.string(),
        actionable: z.string().describe("Acción concreta que el usuario puede tomar"),
      })
    )
    .describe("Sugerencias concretas y accionables"),
  alerts: z
    .array(
      z.object({
        type: z.enum(["overspending", "low-income", "no-savings", "high-debt", "opportunity"]),
        message: z.string(),
        severity: z.enum(["low", "medium", "high"]),
      })
    )
    .describe("Alertas importantes"),
  savingsOpportunity: z
    .number()
    .optional()
    .describe("Estimación de cuánto podría ahorrar por mes basándose en los gastos"),
});

export type InsightsData = z.infer<typeof InsightsSchema>;

interface TransactionSummary {
  period: string;
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
  netBalance: number;
  displayCurrency: string;
  expensesByCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
  countriesActive: string[];
  currenciesUsed: string[];
  monthlyData: Array<{
    month: string;
    income: number;
    expenses: number;
    investments: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY no configurada. Agregala en Configuración > Integración IA." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as TransactionSummary;

    const googleAI = createGoogleGenerativeAI({ apiKey });
    const { object } = await generateObject({
      model: googleAI("gemini-2.5-flash"),
      schema: InsightsSchema,
      messages: [
        {
          role: "user",
          content: `Sos un asesor financiero personal experto en finanzas para Argentina y Uruguay.
          Analizá los siguientes datos financieros del usuario y proporcioná insights útiles, observaciones y sugerencias concretas.

          DATOS FINANCIEROS:
          ${JSON.stringify(body, null, 2)}

          Instrucciones:
          - Respondé siempre en español argentino (vos, che, etc. si es apropiado pero sin exagerar)
          - Tenés en cuenta el contexto de Argentina y Uruguay (inflación, dólar, etc.)
          - Las sugerencias deben ser CONCRETAS y ACCIONABLES, no genéricas
          - Si hay gastos en ARS, considerá el impacto de la inflación
          - El puntaje de salud (0-100): 0-40 crítico, 41-60 regular, 61-80 bueno, 81-100 excelente
          - Identificá si el ratio gastos/ingresos es sostenible
          - Detectá gastos inusuales o categorías que concentran mucho gasto
          - Sugierí si tiene sentido invertir más dado el nivel de ahorro
          - Mantené un tono motivador y constructivo, no alarmista`,
        },
      ],
    });

    return NextResponse.json({ success: true, data: object });
  } catch (error) {
    console.error("Error generating insights:", error);

    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes("API_KEY") || msg.includes("API key")) {
      return NextResponse.json(
        { error: "API key de Gemini inválida. Verificá que esté correctamente configurada en .env.local." },
        { status: 401 }
      );
    }
    if (msg.includes("quota") || msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate_limit") || msg.includes("RetryError")) {
      return NextResponse.json(
        { error: "Quota de Gemini agotada. La API key gratuita tiene límites por minuto. Esperá unos segundos y volvé a intentar." },
        { status: 429 }
      );
    }
    if (msg.includes("not found") || msg.includes("not supported")) {
      return NextResponse.json(
        { error: "Modelo de IA no disponible. Verificá tu plan de Gemini API." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Error al generar el análisis. Intentá de nuevo." }, { status: 500 });
  }
}
