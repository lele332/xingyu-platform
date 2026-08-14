const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_063509_7d167302-4fd4-480b-8260-18ab572333d4.mp4'

export default function SecurifyScene() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white">
      {/* 滑雪者视频背景（Ken Burns 缓慢推镜，保证画面持续运动） */}
      <video
        className="scene-kenburns absolute inset-0 h-full w-full object-cover"
        src={VIDEO}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />
      {/* 上下渐隐，保证底部文案可读 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

      {/* 底部品牌文案 */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center justify-end pb-16 text-center">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">
          Data Security, Fortified
        </p>
        <h1 className="mt-3 text-5xl font-light tracking-tight md:text-7xl">Securify</h1>
        <p className="mt-2 text-base font-light text-white/60 md:text-lg">
          Guard what matters.
        </p>
      </div>
    </div>
  )
}
