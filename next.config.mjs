/** @type {import('next').NextConfig} */

// Content-Security-Policy: restringe origens. Ajuste se adicionar CDNs.
// 'unsafe-inline' e necessario no script-src porque o Next.js injeta scripts
// inline de hidratacao/bootstrap (sem isso, o app nao carrega o JS). O mesmo
// vale para o style-src (Tailwind/estilos inline).
//
// ⚠️ EM DESENVOLVIMENTO O CSP PRECISA SER MAIS FROUXO — e nao e preguica.
//
// O `next dev` compila os modulos com `eval()` (devtool do webpack, e o que faz
// o hot-reload funcionar) e abre um WebSocket `ws://localhost` para avisar o
// navegador de cada recompilacao. O CSP de producao bloqueia os dois.
//
// O efeito e traicoeiro: a pagina RENDERIZA — o HTML vem do servidor e parece
// perfeito — mas o JS do cliente morre no primeiro `eval`, o React nunca
// hidrata e TODO botao do site vira enfeite. Nenhuma requisicao chega ao
// servidor, entao o log fica limpo e parece que o navegador e que esta errado.
// Diagnosticado em 2026-11-23: o login aceitava `admin123` por curl e nao
// fazia nada pelo navegador.
//
// Producao continua EXATAMENTE como estava: sem 'unsafe-eval', sem ws:.
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https:${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // HSTS so em producao: mandado em http://localhost, ele faz o navegador
  // fixar o dominio como HTTPS-only e quebrar o proximo `npm run dev`.
  ...(dev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
    // Logos das BUs quase nunca mudam: guarda a versao otimizada por 1 dia
    // (o padrao e 60s, o que refaz o download/otimizacao varias vezes por hora).
    minimumCacheTTL: 86400,
  },
  experimental: {
    // Importa so os icones/graficos usados em vez do pacote inteiro.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
