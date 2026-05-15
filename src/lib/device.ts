import type { DeviceInfo, AttestationLevel } from '@/types'

export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.hardwareConcurrency,
    navigator.platform,
  ]
  const raw = components.join('|||')
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return `fp_${Math.abs(hash).toString(36)}`
}

export function getDeviceInfo(): DeviceInfo {
  return {
    fingerprint: generateDeviceFingerprint(),
    platform: navigator.platform,
    browser: getBrowserInfo(),
    device_type: getDeviceType(),
    attestation_level: 'web',
  }
}

function getBrowserInfo(): string {
  const ua = navigator.userAgent
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edg')) return 'Edge'
  return 'Unknown'
}

function getDeviceType(): string {
  const ua = navigator.userAgent
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) return 'tablet'
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua))
    return 'mobile'
  return 'desktop'
}

export async function checkWebAuthnSupport(): Promise<boolean> {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined'
  )
}

export async function registerWebAuthnCredential(
  userId: string,
  orgId: string
): Promise<string | null> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: process.env.NEXT_PUBLIC_APP_NAME || 'FaceAttend' },
        user: {
          id: new TextEncoder().encode(userId),
          name: userId,
          displayName: userId,
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
      },
    })) as PublicKeyCredential
    return credential.id
  } catch {
    return null
  }
}

export async function authenticateWebAuthn(credentialId: string): Promise<boolean> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [
          { id: new Uint8Array(credentialId.length), type: 'public-key' },
        ],
        timeout: 60000,
      },
    })
    return !!assertion
  } catch {
    return false
  }
}
