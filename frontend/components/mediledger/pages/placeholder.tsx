import { Icon } from "@/components/mediledger/icon"

interface PlaceholderPageProps {
  title: string
  icon: string
  desc: string
}

export function PlaceholderPage({ title, icon, desc }: PlaceholderPageProps) {
  return (
    <div className="fade-in pt-16 text-center">
      <div className="mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-[18px] border border-mint/20 bg-mint/10">
        <Icon name={icon} size={32} color="#4EC99A" />
      </div>
      <h2 className="mb-3 font-serif text-[26px] text-text-primary">{title}</h2>
      <p className="mx-auto max-w-[400px] leading-relaxed text-text-muted">{desc}</p>
    </div>
  )
}
