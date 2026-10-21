import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

// Static share image (rendered at build time). The OG renderer can't read
// WebP, so it uses the PNG/JPEG copies from scripts/brand-assets.mjs.

export const alt = "ZeeDude SolPump Wager Leaderboard: weekly SOL prizes for the top players";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const asset = async (file: string, mime: string) =>
  `data:${mime};base64,${await readFile(join(process.cwd(), "public/brand", file), "base64")}`;

const [banner, logo] = await Promise.all([asset("og-banner.jpg", "image/jpeg"), asset("zeedude-logo-220.png", "image/png")]);

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "sans-serif" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={banner} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            backgroundImage: "linear-gradient(90deg, rgba(7,5,13,0.96) 0%, rgba(7,5,13,0.85) 52%, rgba(7,5,13,0.1) 100%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 72px", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={150} height={150} alt="" style={{ borderRadius: 999, border: "5px solid #ffc83d" }} />
          <div style={{ display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1.05, textShadow: "0 4px 24px rgba(0,0,0,0.8)" }}>
            <span style={{ color: "#ffc83d" }}>SolPump</span>
            <span style={{ color: "#f6f1ff" }}>Wager Leaderboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, color: "#d9cff0" }}>
            <span>Weekly SOL prizes · Use code</span>
            <span
              style={{
                color: "#07050d",
                background: "#ffc83d",
                padding: "6px 18px",
                borderRadius: 12,
                letterSpacing: 2,
              }}
            >
              {site.referralCode}
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
