export interface StreamMetadataLike {
  name?: string
  title?: string
  description?: string
  behaviorHints?: Record<string, unknown>
}

export function streamMetadataText(stream: StreamMetadataLike): string {
  const filename = typeof stream.behaviorHints?.filename === 'string' ? stream.behaviorHints.filename : ''
  return `${stream.name ?? ''} ${stream.title ?? ''} ${stream.description ?? ''} ${filename}`.toLowerCase()
}

export function similarity(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b
  const longer  = a.length < b.length ? b : a
  if (longer.length === 0) return 1
  if (longer.includes(shorter)) return shorter.length / longer.length
  const tokA = new Set(a.split(/\W+/).filter(Boolean))
  const tokB = new Set(b.split(/\W+/).filter(Boolean))
  let common = 0
  for (const t of tokA) if (tokB.has(t)) common++
  return common / Math.max(tokA.size, tokB.size, 1)
}
