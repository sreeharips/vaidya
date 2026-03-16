// clinics/[slug] profile page — to be implemented
export default function Page({ params }: { params: { lang: string; slug: string } }) {
  return <div className="p-8 text-amber-900">{params.slug}</div>
}
