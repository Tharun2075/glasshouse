/** Same markup and class names as the landing's footer, so every page ends the same way. */
export default function Footer() {
  return (
    <footer className="site-footer" id="footer">
      <div className="wrap site-footer__grid">
        <div className="site-footer__brand">
          <p className="brand">Glasshouse</p>
          <p className="site-footer__note">Every dollar, in the open. Receipts are read by AI; nothing is paid until a trustee says yes.</p>
        </div>
        <nav className="site-footer__col" aria-label="Demo">
          <p className="mono site-footer__h">Demo</p>
          <ul><li><a href="/ledger">Public ledger</a></li><li><a href="/trace/12">Trace a gift</a></li><li><a href="/donate">Give</a></li></ul>
        </nav>
        <nav className="site-footer__col" aria-label="Account">
          <p className="mono site-footer__h">Account</p>
          <ul><li><a href="/login">Sign in</a></li><li><a href="/volunteer">Upload a receipt</a></li><li><a href="/trustee">Approvals</a></li></ul>
        </nav>
        <nav className="site-footer__col" aria-label="Code">
          <p className="mono site-footer__h">Code</p>
          <ul><li><a href="https://github.com/Tharun2075/glasshouse">GitHub</a></li></ul>
        </nav>
        <p className="site-footer__legal mono">Sandbox demo: PayPal sandbox only, no real money moves. Demo data resets on restart.</p>
      </div>
    </footer>
  );
}
