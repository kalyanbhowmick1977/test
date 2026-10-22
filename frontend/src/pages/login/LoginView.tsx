import { useState } from 'react';
import type { ChangeEventHandler, FormEventHandler } from 'react';
import { ArrowRight, Building2, BarChart3, Eye, EyeOff, FileText, Layers3, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import fitekLogo from '../../assets/fitek-logo-white.png';
import './login.css';

type LoginViewProps = {
  username: string;
  password: string;
  onUsernameChange: ChangeEventHandler<HTMLInputElement>;
  onPasswordChange: ChangeEventHandler<HTMLInputElement>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  notice?: string;
  microsoftEnabled?: boolean;
  microsoftBusy?: boolean;
  onMicrosoftSignIn?: () => void;
};

export default function LoginView({ username, password, onUsernameChange, onPasswordChange, onSubmit, loading, disabled, error, notice, microsoftEnabled, microsoftBusy, onMicrosoftSignIn }: LoginViewProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="ht-login">
      <section className="ht-login-brand" aria-labelledby="ht-login-title">
        <div className="ht-login-wordmark">
          <span className="ht-login-logo"><img src={fitekLogo} alt="Fi-Tek LLC" width={155} height={46} /></span>
          <span className="ht-login-product">HEDGETEK</span>
        </div>

        <div className="ht-login-intro">
          <p className="ht-login-eyebrow"><span /> FUND ADMINISTRATION</p>
          <h1 id="ht-login-title">Clarity in every<br /><span>financial detail.</span></h1>
          <p className="ht-login-description">Design pages, configure controls, and preview layouts in your standalone workspace.</p>

          <div className="ht-login-platform" aria-label="HedgeTek platform capabilities">
            <div className="ht-login-platform-heading"><Layers3 size={19} strokeWidth={1.5} /><span>One connected workspace</span></div>
            <div className="ht-login-capabilities">
              <div><Building2 size={23} strokeWidth={1.4} /><span>Fund<br />operations</span></div>
              <div><BarChart3 size={23} strokeWidth={1.4} /><span>Portfolio<br />accounting</span></div>
              <div><FileText size={23} strokeWidth={1.4} /><span>Investor<br />reporting</span></div>
            </div>
          </div>
        </div>

        <footer className="ht-login-brand-footer"><span>HedgeTek Fund Administration</span><span>By Fi-Tek LLC</span></footer>
        <div className="ht-login-contours" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>

      <section className="ht-login-access" aria-labelledby="ht-login-welcome">
        <div className="ht-login-access-header"><span className="ht-login-product">HedgeTek</span><span className="ht-login-portal">CLIENT PORTAL</span></div>

        <div className="ht-login-form-wrap">
          <div className="ht-login-access-icon"><LockKeyhole size={23} strokeWidth={1.5} aria-hidden="true" /></div>
          <p className="ht-login-form-eyebrow">YOUR WORKSPACE AWAITS</p>
          <h2 id="ht-login-welcome">Welcome back</h2>
          <p className="ht-login-form-description">Sign in to your local PageBuilder account to continue.</p>

          <form onSubmit={onSubmit} className="ht-login-form" aria-busy={!!loading}>
            <div className="ht-login-field">
              <label htmlFor="ht-login-username">Username</label>
              <div className="ht-login-input-wrap">
                <UserRound size={18} aria-hidden="true" />
                <input id="ht-login-username" name="username" value={username} onChange={onUsernameChange} placeholder="Enter your username" autoComplete="username" autoCapitalize="none" spellCheck={false} required aria-describedby={error ? 'ht-login-error' : undefined} />
              </div>
            </div>
            <div className="ht-login-field">
              <label htmlFor="ht-login-password">Password</label>
              <div className="ht-login-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input id="ht-login-password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={onPasswordChange} placeholder="Enter your password" autoComplete="current-password" required aria-describedby={error ? 'ht-login-error' : undefined} />
                <button className="ht-login-reveal" type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {notice && !error && <p className="ht-login-notice" role="status">{notice}</p>}
            {error && <p id="ht-login-error" className="ht-login-error" role="alert">{error}</p>}
            <button type="submit" className="ht-login-submit" disabled={!!loading || disabled}>
              {loading ? <><Loader2 size={18} className="ht-login-spinner" /> Signing in...</> : <>Sign In <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="ht-login-help"><span>Need help signing in?</span><p>Contact your system administrator for assistance.</p></div>
        </div>

        <footer className="ht-login-access-footer">&copy; {new Date().getFullYear()} Fi-Tek LLC. All rights reserved.</footer>
      </section>
    </main>
  );
}
