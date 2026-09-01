const VIDEO =
  '/assets/scenes/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4'

/** 棱镜艺境：全屏云海视频沉浸场景（与其余场景统一，避免长页面/多视频导致卡顿） */
export default function PrismaScene() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white">
      {/* 云海山谷视频背景 */}
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
          Creative Studio
        </p>
        <h1 className="mt-3 text-5xl font-light tracking-tight md:text-7xl">Prisma</h1>
        <p className="mt-2 text-base font-light text-white/60 md:text-lg">
          A worldwide network of visual storytellers.
        </p>
      </div>
    </div>
  )
}
