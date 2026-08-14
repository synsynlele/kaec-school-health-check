export const SITE = {
  name: "KAEC School Health Check",
  shortName: "KAEC",
  companyName: "KAEC-NG",
  companyCategory: "Human Potential Development Company",
  tagline: "Know the Health of Your School in Minutes.",
  description:
    "KAEC School Health Check is the free diagnostic front door to KHP-OS, built by KAEC-NG — a Human Potential Development Company helping people and institutions Discover, Develop and Deploy Potential.",
  email: "kaecng@gmail.com",
  location: "43 Isuti road, Lagos, Nigeria",
  website: "www.kaecng.name.ng",
  phone: "08061190801",
};

export function appUrl(path = ""): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base}${path}`;
}
