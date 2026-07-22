import { prisma } from "@/lib/db";
import { formatCompact } from "@/lib/format";
import { probYes } from "@/lib/lmsr";
import { pricedOutcomes } from "@/lib/market";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/**
 * Standalone, self-contained HTML widget for embedding a market in an iframe.
 * Served as a route handler so it escapes the app's navbar/footer layout.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await prisma.market.findUnique({
    where: { id },
    include: { outcomes: true },
  });
  if (!market) return new Response("Market not found", { status: 404 });

  const origin = new URL(req.url).origin;
  const url = `${origin}/markets/${id}`;
  const isCat = market.kind === "CATEGORICAL";

  let rowsHtml: string;
  if (isCat) {
    const priced = pricedOutcomes(market.outcomes, market.liquidityB)
      .sort((a, z) => z.price - a.price)
      .slice(0, 4);
    rowsHtml = priced
      .map(
        (o) => `<div class="row"><span class="label">${esc(o.label)}</span>
        <span class="pct">${Math.round(o.price * 100)}%</span></div>`
      )
      .join("");
  } else {
    const p = market.resolution
      ? market.resolution === "YES"
        ? 1
        : 0
      : probYes({ qYes: market.qYes, qNo: market.qNo, b: market.liquidityB });
    rowsHtml = `<div class="row"><span class="label">Yes</span><span class="pct big">${Math.round(p * 100)}%</span></div>`;
  }

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(market.question)}</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box;margin:0}
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    background:#fff;color:#18181b;padding:16px}
  a.card{display:block;text-decoration:none;color:inherit;border:1px solid #e4e4e7;
    border-radius:16px;padding:16px;max-width:420px}
  .q{font-size:15px;font-weight:600;line-height:1.35;margin-bottom:12px}
  .row{display:flex;align-items:center;justify-content:space-between;
    padding:6px 0;border-top:1px solid #f4f4f5;font-size:14px}
  .row:first-of-type{border-top:none}
  .label{color:#3f3f46}
  .pct{font-variant-numeric:tabular-nums;font-weight:700;color:#4f46e5}
  .pct.big{font-size:28px}
  .foot{display:flex;justify-content:space-between;margin-top:12px;
    font-size:12px;color:#a1a1aa}
  .brand{font-weight:700}
  @media (prefers-color-scheme:dark){
    body{background:#09090b;color:#fafafa}
    a.card{border-color:#27272a}
    .row{border-color:#18181b}
    .label{color:#d4d4d8}
    .foot{color:#71717a}
  }
</style></head>
<body>
  <a class="card" href="${esc(url)}" target="_blank" rel="noopener">
    <div class="q">${esc(market.question)}</div>
    ${rowsHtml}
    <div class="foot">
      <span>${esc(formatCompact(market.volume))} Vol</span>
      <span class="brand">🔮 Foresight</span>
    </div>
  </a>
</body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
