export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (<>
    <h1>Sign in</h1>
    {sp.error && <p className="note err" role="alert">That email and password did not match.</p>}
    <form className="stack" method="post" action="/api/auth/login">
      <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required />
      <p><button type="submit">Sign in</button></p>
    </form>
    <h2>Judges: use these demo logins (sandbox only)</h2>
    <table className="plain"><thead><tr><th>Role</th><th>Email</th></tr></thead><tbody>
      <tr><td>Donor</td><td className="mono">donor@northside.test</td></tr>
      <tr><td>Volunteer</td><td className="mono">volunteer@northside.test</td></tr>
      <tr><td>Trustee</td><td className="mono">trustee@northside.test</td></tr>
    </tbody></table>
    <p className="muted">Password for all three: <code>glasshouse-demo</code></p>
  </>);
}
