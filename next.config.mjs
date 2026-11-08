/** @type {import('next').NextConfig} */

// Content-Security-Policy: restringe origens. Ajuste se adicionar CDNs.
// 'unsafe-inline' e necessario no script-src porque o Next.js injeta scripts
// inline de hidratacao/bootstrap (sem isso, o app nao carrega o JS). O mesmo
// vale para o style-src (Tailwind/estilos inline).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
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
