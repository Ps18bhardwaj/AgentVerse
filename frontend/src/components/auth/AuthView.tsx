import React, { useState } from "react";
import { useStore } from "@/store";
import {
  forgotPassword,
  getOAuthUrl,
  loginUser,
  registerUser,
  resetPassword,
} from "@/lib/api";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { toast } from "sonner";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Sparkles,
} from "lucide-react";


export const AuthView: React.FC = () => {
  const setUser = useStore((s) => s.setUser);
  const setAuthStatus = useStore((s) => s.setAuthStatus);

  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset" | "verify">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Password reset state
  const [resetToken, setResetToken] = useState("");
  const [devTokenMsg, setDevTokenMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!emailOrUsername || !password) {
      setErrorMsg("Please enter both email/username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await loginUser({
        email_or_username: emailOrUsername,
        password,
        remember_me: rememberMe,
      });
      setUser(res.user);
      setAuthStatus("authenticated");
      toast.success(`Welcome back, ${res.user.first_name}!`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName || !lastName || !username || !email || !password) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }
    if (!termsAccepted) {
      setErrorMsg("You must accept the Terms of Service to register.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser({
        first_name: firstName,
        last_name: lastName,
        username,
        email,
        password,
        terms_accepted: termsAccepted,
      });
      setUser(res.user);
      setAuthStatus("authenticated");
      toast.success(
        res.user.role === "System Owner"
          ? "System Owner Account Registered!"
          : "Account registered successfully!"
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res.reset_token_dev) {
        setResetToken(res.reset_token_dev);
        setDevTokenMsg(`Dev Reset Token generated: ${res.reset_token_dev}`);
        setMode("reset");
      }
      toast.success(res.message);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process request.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!resetToken || !password) {
      setErrorMsg("Please provide token and new password.");
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword(resetToken, password);
      toast.success(res.message);
      setMode("signin");
    } catch (err: any) {
      setErrorMsg(err.message || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: string) => {
    try {
      const redirectUri = `${window.location.origin}/auth/oauth/callback`;
      const res = await getOAuthUrl(provider, redirectUri);
      // Simulating OAuth callback code for instant local development testing
      const mockCode = `oauth_code_${provider}_${Date.now()}`;
      toast.info(`Redirecting to ${provider} OAuth...`);
      // Trigger callback exchange
      const callbackRes = await fetch(`/api/auth/oauth/${provider}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mockCode, redirect_uri: redirectUri }),
        credentials: "include",
      });
      if (callbackRes.ok) {
        const data = await callbackRes.json();
        setUser(data.user);
        setAuthStatus("authenticated");
        toast.success(`Signed in with ${provider.toUpperCase()}!`);
      } else {
        window.location.href = res.url;
      }
    } catch (err: any) {
      toast.error(`OAuth login failed: ${err.message}`);
    }
  };

  const handleGuestLogin = () => {
    setUser({
      id: "dev-owner-001",
      first_name: "System",
      last_name: "Owner",
      name: "System Owner",
      username: "system_owner",
      email: "owner@agentverse.ai",
      role: "System Owner",
      permissions: [],
      organization: "AgentVerse Workspaces",
      account_status: "active",
      email_verified: true,
      two_factor_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      timezone: "UTC",
      language: "en",
      theme: "system",
      notification_preferences: {
        email_alerts: true,
        security_alerts: true,
        workspace_invites: true,
        agent_completion: true,
      },
      api_keys: [],
      connected_accounts: [],
    });
    setAuthStatus("authenticated");
    toast.success("Welcome! Entered AgentVerse AI Workspace.");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-background via-background/95 to-secondary/30 p-4 select-none">
      {/* Subtle Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none" />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card/85 backdrop-blur-xl shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AgentVerse Enterprise</h1>

          <p className="text-xs text-muted-foreground max-w-xs">
            Production Intelligence & Knowledge Workspace
          </p>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 animate-in fade-in duration-200 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {devTokenMsg && (
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-300 animate-in fade-in duration-200">
            {devTokenMsg}
          </div>
        )}

        {/* SIGN IN FORM */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Email or Username</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="name@company.com or username"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/50 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-foreground">Password</label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/50 pl-9 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                Remember Me (30 Days)
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  Sign In <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleGuestLogin}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-950/30 py-2.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-900/50 hover:text-white"
            >
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Continue as Guest Demo Mode
            </button>
          </form>
        )}

        {/* SIGN UP FORM */}
        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">First Name</label>
                <input
                  type="text"
                  required
                  placeholder="Sarah"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Last Name</label>
                <input
                  type="text"
                  required
                  placeholder="Connor"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Username</label>
              <input
                type="text"
                required
                placeholder="sarah_architect"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full rounded-lg border border-input bg-background/50 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Work Email</label>
              <input
                type="email"
                required
                placeholder="sarah@agentverse.ai"

                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-input bg-background/50 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/50 pl-3 pr-10 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={password} />
            </div>

            <label className="flex items-start gap-2 cursor-pointer text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded border-input text-primary focus:ring-primary"
              />
              <span>
                I agree to the <span className="text-primary hover:underline">Terms of Service</span> and{" "}
                <span className="text-primary hover:underline">Privacy Policy</span>.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Create Enterprise Account"
              )}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-muted-foreground text-center">
              Enter your registered work email and we will send password reset instructions.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Registered Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background/50 pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full text-center text-xs text-primary hover:underline"
            >
              Back to Sign In
            </button>
          </form>
        )}

        {/* RESET PASSWORD FORM */}
        {mode === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Reset Token</label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <PasswordStrengthMeter password={password} />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-50"
            >
              Update Password
            </button>
          </form>
        )}

        {/* SOCIAL LOGINS */}
        {(mode === "signin" || mode === "signup") && (
          <div className="space-y-4 pt-2">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <span className="relative bg-card px-3 text-[11px] text-muted-foreground uppercase tracking-wider">
                Or Continue With
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-background/40 py-2 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                  />
                </svg>
                Google
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("github")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-background/40 py-2 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>

                GitHub
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("microsoft")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-background/40 py-2 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                Microsoft
              </button>
            </div>
          </div>
        )}

        {/* TOGGLE MODE FOOTER */}
        <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border/40">
          {mode === "signin" ? (
            <span>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorMsg(null);
                }}
                className="font-semibold text-primary hover:underline"
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMsg(null);
                }}
                className="font-semibold text-primary hover:underline"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
