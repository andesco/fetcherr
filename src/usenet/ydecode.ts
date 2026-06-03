// yEncode decoder. Input is the raw article body buffer (binary).
// Returns the decoded payload bytes.
export function ydecode(input: Buffer): Buffer {
  const lines = input.toString('binary').split(/\r?\n/)

  let inBody = false
  const outputChunks: number[] = []

  for (const line of lines) {
    if (line.startsWith('=ybegin') || line.startsWith('=ypart')) {
      inBody = true
      continue
    }
    if (line.startsWith('=yend')) break
    if (!inBody) continue

    for (let i = 0; i < line.length; i++) {
      let byte = line.charCodeAt(i) & 0xff
      if (byte === 0x3d) {
        // Escape: next char is the real byte, offset by 64
        i++
        if (i >= line.length) break
        byte = ((line.charCodeAt(i) & 0xff) - 64 + 256) % 256
        outputChunks.push((byte - 42 + 256) % 256)
      } else {
        outputChunks.push((byte - 42 + 256) % 256)
      }
    }
  }

  return Buffer.from(outputChunks)
}
