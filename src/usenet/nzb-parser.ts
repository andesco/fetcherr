export interface NzbSegment {
  messageId: string
  bytes: number
  number: number
}

export interface NzbFile {
  subject: string
  filename: string
  segments: NzbSegment[]
  totalBytes: number
}

export interface ParsedNzb {
  file: NzbFile
  estimatedDecodedBytes: number
}

const VIDEO_EXTS = new Set(['mkv', 'mp4', 'avi', 'mov', 'm4v', 'ts', 'wmv', 'webm'])
const RAR_PATTERN = /\.(?:rar|r\d{2,3}|part\d+\.rar)$/i

function extractFilename(subject: string): string {
  // Match quoted filename or filename with extension
  const quoted = subject.match(/"([^"]+\.[a-zA-Z0-9]{2,5})"/)
  if (quoted) return quoted[1]
  const unquoted = subject.match(/\b([\w. -]+\.(?:mkv|mp4|avi|mov|m4v|ts|wmv|webm|rar|r\d{2,3}))\b/i)
  if (unquoted) return unquoted[1]
  return subject.split(' - ')[0].trim()
}

function isVideoFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return VIDEO_EXTS.has(ext)
}

function isRarFile(filename: string): boolean {
  return RAR_PATTERN.test(filename)
}

// yEncode decoded size ≈ encoded bytes * (128/130) per line minus header overhead
function estimateDecodedBytes(encodedBytes: number): number {
  return Math.max(0, Math.floor((encodedBytes - 200) * 128 / 130))
}

export function parseNzb(xml: string): ParsedNzb | null {
  // Extract all <file> blocks
  const fileMatches = [...xml.matchAll(/<file\b[^>]*>([\s\S]*?)<\/file>/gi)]
  if (!fileMatches.length) return null

  const files: NzbFile[] = []

  for (const fileMatch of fileMatches) {
    const fileBlock = fileMatch[0]

    // Extract subject attribute
    const subjectMatch = fileBlock.match(/\bsubject="([^"]*)"/)
    const subject = subjectMatch ? subjectMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : ''

    const filename = extractFilename(subject)

    // Skip non-video and RAR files
    if (!isVideoFile(filename) || isRarFile(filename)) continue

    // Extract segments
    const segmentMatches = [...fileBlock.matchAll(/<segment\s+bytes="(\d+)"\s+number="(\d+)"[^>]*>([^<]+)<\/segment>/gi)]
    if (!segmentMatches.length) continue

    const segments: NzbSegment[] = segmentMatches.map(m => ({
      messageId: m[3].trim(),
      bytes: parseInt(m[1], 10),
      number: parseInt(m[2], 10),
    }))

    segments.sort((a, b) => a.number - b.number)
    const totalBytes = segments.reduce((sum, s) => sum + s.bytes, 0)
    files.push({ subject, filename, segments, totalBytes })
  }

  if (!files.length) return null

  // If there are multiple video files (e.g. multi-part release with named parts),
  // check if all have the same base name (they're parts of the same file)
  // Otherwise pick the largest single video file
  const mainFile = files.reduce((best, f) => f.totalBytes > best.totalBytes ? f : best, files[0])

  return {
    file: mainFile,
    estimatedDecodedBytes: mainFile.segments.reduce((sum, s) => sum + estimateDecodedBytes(s.bytes), 0),
  }
}

// Cumulative byte offset table for range → segment mapping
export function buildOffsetTable(segments: NzbSegment[]): number[] {
  const offsets: number[] = []
  let offset = 0
  for (const seg of segments) {
    offsets.push(offset)
    offset += estimateDecodedBytes(seg.bytes)
  }
  return offsets
}

// Find which segment index contains the given byte offset
export function segmentIndexForOffset(offsets: number[], byteOffset: number): number {
  for (let i = offsets.length - 1; i >= 0; i--) {
    if (offsets[i] <= byteOffset) return i
  }
  return 0
}
