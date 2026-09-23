/**
 * Demo Management Footer — the presenter toolkit.
 *
 * The ONE templated UI component. Purpose is functional: it provides the
 * Snowplow SDK controls SEs use during demos. Structure and CONTROL ORDER are
 * identical across all demos — UTM Reload → Clear Identity → Manage Consent →
 * Signals toggle → Watch Video. Only the theming should change per demo; keep
 * the controls and their behavior.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { siteConfig } from '@/lib/config';
import { resetSession, clearAllUserData } from '@/lib/snowplow-config';
import { buildUrlWithUtm } from '@/lib/utils';
import { isSignalsEnabled, setSignalsEnabled } from '@/lib/consent';
import { clearStoredBasket } from '@/contexts/shop-context';

export default function DemoFooter() {
  const router = useRouter();
  const [signalsOn, setSignalsOn] = useState(true);
  const [signalsDropdownOpen, setSignalsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync Signals state from localStorage on mount (intentional one-time sync
  // from an external store — not a cascading-render risk).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignalsOn(isSignalsEnabled());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setSignalsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleUtmReload = () => {
    resetSession();
    clearStoredBasket(); // fresh session starts with an empty basket
    const newUrl = buildUrlWithUtm(window.location.href);
    window.location.href = newUrl;
  };

  const handleClearIdentity = () => {
    // Wipe domain_userid + domain_sessionid, then reload so the page starts
    // as a fresh anonymous visitor.
    clearAllUserData();
    window.location.reload();
  };

  const handleManageConsent = () => {
    window.dispatchEvent(new CustomEvent('showConsentManager'));
  };

  const handleSignalsToggle = (enabled: boolean) => {
    setSignalsEnabled(enabled);
    setSignalsOn(enabled);
    setSignalsDropdownOpen(false);
  };

  const handleWatchVideo = () => {
    router.push('/video');
  };

  // Split footer links into cross-domain (snowplow.io) and regular site links
  const crossDomainLinks = siteConfig.navigation.footerLinks.filter((link) =>
    link.href.includes('snowplow.io')
  );
  const siteLinks = siteConfig.navigation.footerLinks.filter(
    (link) => !link.href.includes('snowplow.io')
  );

  return (
    <footer className="border-t border-border bg-background text-body">
      {/* Four link columns under mono uppercase headings, then a closing row
          with the wordmark and the delivery-area note. Restrained by design —
          no newsletter takeover. */}
      <div className="mx-auto max-w-page px-6 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <FooterColumn title="Shop" links={siteConfig.navigation.mainMenu.slice(0, 4)} />
          <FooterColumn title="Aisles" links={siteConfig.navigation.mainMenu.slice(4)} />
          <FooterColumn title="Help" links={siteLinks} />
          <div>
            <h4 className="num mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Contact
            </h4>
            <ul className="space-y-1.5 text-small">
              <li>
                <a
                  href={`mailto:${siteConfig.business.contact.email}`}
                  className="text-body transition-colors hover:text-primary"
                >
                  {siteConfig.business.contact.email}
                </a>
              </li>
              <li className="num text-body">{siteConfig.business.contact.phone}</li>
              <li className="text-muted">{siteConfig.business.contact.address}</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-5">
          <span className="font-heading text-[18px] font-bold tracking-[-0.05em] text-primary">
            {siteConfig.brand.name}
          </span>
          <p className="text-small text-muted">
            {siteConfig.brand.tagline} Delivering across Greater London, Mon–Sun{' '}
            <span className="num">08:00–22:00</span>.
          </p>
          <p className="num text-[11px] text-muted">
            &copy; {new Date().getFullYear()} {siteConfig.brand.name}
          </p>
        </div>
      </div>

      {/* Bottom bar: demo tools (left) + cross-domain links (right) */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-page items-center gap-4 px-6 py-4 text-xs text-muted">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            {/* 1. UTM Reload */}
            {siteConfig.features.utmParameters && (
              <button
                onClick={handleUtmReload}
                className="transition-colors hover:text-primary"
              >
                UTM Reload
              </button>
            )}

            {/* 2. Clear Identity — wipes domain_userid + domain_sessionid */}
            <button
              onClick={handleClearIdentity}
              className="transition-colors hover:text-primary"
            >
              Clear Identity
            </button>

            {/* 3. Manage Consent */}
            {siteConfig.features.consent && (
              <button
                onClick={handleManageConsent}
                className="transition-colors hover:text-primary"
              >
                Manage Consent
              </button>
            )}

            {/* 4. Signals Toggle */}
            {siteConfig.features.signals && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setSignalsDropdownOpen(!signalsDropdownOpen)}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      signalsOn ? 'bg-accent' : 'bg-muted'
                    }`}
                  />
                  Signals {signalsOn ? 'ON' : 'OFF'}
                </button>

                {signalsDropdownOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-1 w-40 overflow-hidden rounded-md border border-border bg-surface-raised shadow-lg">
                    <button
                      onClick={() => handleSignalsToggle(true)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-surface ${
                        signalsOn ? 'font-bold text-accent' : 'text-body'
                      }`}
                    >
                      Enable Signals
                    </button>
                    <button
                      onClick={() => handleSignalsToggle(false)}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-surface ${
                        !signalsOn ? 'font-bold text-heading' : 'text-body'
                      }`}
                    >
                      Disable Signals
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 5. Watch Video */}
            {siteConfig.features.video && (
              <button
                onClick={handleWatchVideo}
                className="transition-colors hover:text-primary"
              >
                Watch Video
              </button>
            )}
          </div>

          {/* Cross-domain links — right-aligned */}
          <div className="flex-1" />
          <div className="flex flex-shrink-0 items-center gap-4">
            {crossDomainLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-primary"
              >
                {link.label}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  if (links.length === 0) return null;
  return (
    <div>
      <h4 className="num mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      <ul className="space-y-1.5 text-small">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="text-body transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
