export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; email?: string }> }) {
  const sp = await searchParams;
  return (<div className="login">
    <div className="hero rise"><p className="eyebrow">Volunteers and trustees</p><h1>Sign in to <em>decide</em>.</h1>
    <p className="lede">Volunteers upload receipts, trustees approve spends. Donors do not need an account.</p></div>
    <div className="split rise d1"><div className="panel">
    {sp.error && <p className="note err" role="alert">That email and password did not match.</p>}
    <form className="stack" method="post" action="/api/auth/login">
      <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required defaultValue={sp.email ?? ""} autoFocus={!sp.error} />
      <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required autoFocus={!!sp.error} />
      <p><button type="submit" className="btn lg">Sign in</button></p>
    </form></div>
    <div className="panel"><h2>Judges: use these demo logins (sandbox only)</h2>
    <table className="plain"><thead><tr><th>Role</th><th>Email</th></tr></thead><tbody>
      <tr><td>Donor</td><td className="mono">donor@northside.test</td></tr>
      <tr><td>Volunteer</td><td className="mono">volunteer@northside.test</td></tr>
      <tr><td>Trustee</td><td className="mono">trustee@northside.test</td></tr>
    </tbody></table>
    <p className="muted">Password for all three: <code>glasshouse-demo</code></p></div></div>
  </div>);
}
