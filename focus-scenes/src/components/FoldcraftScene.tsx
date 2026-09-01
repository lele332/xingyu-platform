const VIDEO =
  '/assets/scenes/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4'

export default function FoldcraftScene() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white">
      {/* 金鱼水方块视频背景 */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
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
          Visual Craft & Motion
        </p>
        <h1 className="mt-3 text-5xl font-light tracking-tight md:text-7xl">Foldcraft</h1>
        <p className="mt-2 text-base font-light text-white/60 md:text-lg">
          One pixel at a time.
        </p>
      </div>
    </div>
  )
}
