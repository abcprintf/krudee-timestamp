// Pure logic to decide auto-update policy — separated for unit testing (like scan-logic.ts)

function parse(v: string): [number, number, number] {
  const core = String(v).trim().replace(/^v/, '').split(/[-+]/)[0]
  const [a, b, c] = core.split('.').map((n) => Number.parseInt(n, 10))
  return [a || 0, b || 0, c || 0]
}

export function compareVersions(a: string, b: string): number {
  const pa = parse(a), pb = parse(b)
  for (let i = 0; i < 3; i++) { if (pa[i] > pb[i]) return 1; if (pa[i] < pb[i]) return -1 }
  return 0
}

export function shouldDownload(newVersion: string, targetVersion: string | undefined): boolean {
  if (!targetVersion) return false
  return compareVersions(newVersion, targetVersion) <= 0
}

export interface InstallDecision {
  now: Date; windowStart: string; windowEnd: string; autoInstall: boolean
  pendingVersion: string | null; targetVersion: string | undefined
  lastScanAt: string | null; idleMs: number
}

function minutes(hhmm: string): number { const [h, m] = hhmm.split(':').map((n) => Number.parseInt(n, 10)); return (h || 0) * 60 + (m || 0) }

export function shouldInstallNow(p: InstallDecision): boolean {
  if (!p.autoInstall || !p.pendingVersion) return false
  if (shouldDownload(p.pendingVersion, p.targetVersion) === false) return false
  const cur = p.now.getHours() * 60 + p.now.getMinutes()
  if (cur < minutes(p.windowStart) || cur > minutes(p.windowEnd)) return false
  if (p.lastScanAt && p.now.getTime() - new Date(p.lastScanAt).getTime() < p.idleMs) return false
  return true
}
