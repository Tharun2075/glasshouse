// Same chrome as every page (layout wraps it); one line and a way back.
export default function NotFound() {
  return (<section className="hero rise">
    <p className="eyebrow">404 · not found</p>
    <h1>Nothing to see <em>through</em> here.</h1>
    <p className="lede">This page does not exist. Every real dollar is on the public ledger.</p>
    <div className="cta-row"><a className="btn lg" href="/ledger">Open the public ledger</a></div>
  </section>);
}
