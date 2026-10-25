export default function Footer() {
  return (
    <footer className="site">
      <div className="in">
        <p><strong>Glasshouse</strong> · every dollar, in the open. Receipts are read by AI; nothing is paid until a trustee says yes.</p>
        <nav aria-label="Footer">
          <a href="/ledger">Public ledger</a>
          <a href="/donate">Donate</a>
          <a href="/ledger#gift">Trace a gift</a>
          <a href="/login">Sign in</a>
        </nav>
        <p className="sandbox">Sandbox demo: PayPal sandbox only, no real money moves. Demo data resets on restart.</p>
      </div>
    </footer>
  );
}
