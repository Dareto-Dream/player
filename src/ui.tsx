import { AudioLines, ArrowUpRight, LogOut, Music2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ward, type WardProfile } from './auth'

export function useAccount() {
  const [profile, setProfile] = useState<WardProfile | null>(null)
  useEffect(() => {
    let active = true
    ward.hydrateCallback()
    void ward
      .profile()
      .then((value) => {
        if (active) setProfile(value)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return {
    profile,
    signOut: () => {
      ward.signOut()
      setProfile(null)
    },
  }
}

export function Header({
  account,
}: {
  account: ReturnType<typeof useAccount>
}) {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a className="brand" href="/" aria-label="Spectralis Player home">
          <span className="brand-mark">
            <AudioLines size={24} strokeWidth={1.7} />
          </span>
          <span>
            spectralis<span className="brand-subtitle">PLAYER</span>
          </span>
        </a>
        <span className="header-note">a little place to listen.</span>
        {account.profile ? (
          <div className="account">
            <span>
              {account.profile.name ||
                account.profile.preferred_username ||
                'Ward account'}
            </span>
            <button
              className="icon-button"
              onClick={account.signOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        ) : (
          <button className="button button-quiet" onClick={() => ward.signIn()}>
            Sign in <ArrowUpRight size={16} />
          </button>
        )}
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="site-footer shell">
      <a href="https://deltavdevs.com" target="_blank" rel="noreferrer">
        <span className="delta-mark" aria-hidden="true">
          Δ
        </span>{' '}
        built by deltavdevs <ArrowUpRight size={12} />
      </a>
      <span>good music. good company.</span>
    </footer>
  )
}

export function Artwork({
  src,
  name,
  className = '',
}: {
  src?: string | null
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  const safeSrc = src && /^(https?:|blob:)/i.test(src) ? src : undefined
  // A quiet record sleeve for rooms without uploaded art, not a pretend album cover.
  const tone = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3
  return (
    <div className={`artwork sleeve-${tone} ${className}`}>
      {safeSrc && !failed ? (
        <img
          src={safeSrc}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="record-sleeve" aria-hidden="true">
          <div className="record-disc">
            <span>
              <Music2 size={19} strokeWidth={1.5} />
            </span>
          </div>
          <span className="sleeve-label">S / P</span>
          <span className="sleeve-lines" />
        </div>
      )}
    </div>
  )
}

export function savedValue(key: string, fallback: string) {
  try {
    return sessionStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

export function saveValue(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* Private browsing can disable storage. */
  }
}

export function ErrorNotice({
  message,
  retry,
}: {
  message: string
  retry?: () => void
}) {
  return (
    <div className="error-notice" role="alert">
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  )
}
