import { useEffect } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

const connections = [
  { className: 'signin-connection signin-connection-one', delay: '0s' },
  { className: 'signin-connection signin-connection-two', delay: '-2.4s' },
  { className: 'signin-connection signin-connection-three', delay: '-4.8s' },
];

export default function SignInPage({ onSignIn }) {
  useEffect(() => {
    document.title = 'Sign In | Net Term Solutions';
  }, []);

  return (
    <main className="signin-page">
      <div className="signin-grid" aria-hidden="true" />
      <div className="signin-network" aria-hidden="true">
        <div className="signin-world">
          <img src="/network-world.svg" alt="" />
          <span className="signin-beacon signin-beacon-one" />
          <span className="signin-beacon signin-beacon-two" />
          <span className="signin-beacon signin-beacon-three" />
          <span className="signin-beacon signin-beacon-four" />
        </div>
        <div className="signin-ring signin-ring-one" />
        <div className="signin-ring signin-ring-two" />
        {connections.map(({ className, delay }) => (
          <div key={className} className={className}>
            <span className="signin-packet" style={{ animationDelay: delay }} />
          </div>
        ))}
        <span className="signin-node signin-node-one" />
        <span className="signin-node signin-node-two" />
        <span className="signin-node signin-node-three" />
        <span className="signin-node signin-node-four" />
        <div className="signin-cat6">
          <span className="signin-cable-signal" />
          <span className="signin-rj45 signin-rj45-left"><i /><i /><i /><i /><i /><i /><i /><i /></span>
          <span className="signin-rj45 signin-rj45-right"><i /><i /><i /><i /><i /><i /><i /><i /></span>
        </div>
      </div>

      <section className="signin-content">
        <div className="signin-brand">
          <img src="/netterm-logo.svg" alt="Net Term Solutions" />
        </div>

        <div className="signin-copy">
          <p className="signin-eyebrow"><ShieldCheck aria-hidden="true" /> Secure workspace</p>
          <h1>Welcome back.</h1>
          <p>Sign in to continue to your team workspace.</p>
        </div>

        <div className="signin-panel">
          <button className="signin-google" type="button" onClick={onSignIn}>
            <span className="signin-google-mark" aria-hidden="true">G</span>
            <span>Sign in with Google</span>
            <ArrowRight aria-hidden="true" />
          </button>
          <p>Use your authorized Net Term Solutions account.</p>
        </div>
      </section>

      <p className="signin-footer">Protected access · Net Term Solutions</p>
    </main>
  );
}