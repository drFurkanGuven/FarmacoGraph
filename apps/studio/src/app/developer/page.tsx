"use client";

import { useState } from "react";
import {
  Bot,
  Building2,
  Check,
  Code2,
  Copy,
  GraduationCap,
  KeyRound,
  Terminal,
} from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";

type IntendedUse = "education" | "research" | "healthtech_demo" | "student_project" | "ai_agent";

export default function DeveloperPortalPage() {
  const [copiedKey, setCopiedKey] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [intendedUse, setIntendedUse] = useState<IntendedUse>("research");
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) {
      setError("Please provide a name and email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.request<{
        api_key: string;
        expires_at: string;
      }>("/developer/instant-key", {
        method: "POST",
        body: {
          name,
          email,
          organization: org || undefined,
          intended_use: intendedUse,
        },
      });
      setGeneratedKey(response.data.api_key);
      setExpiresAt(response.data.expires_at);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Key issuance failed. Is the API reachable?"
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-3">
          <Code2 className="w-3.5 h-3.5" />
          API Platform & Partner Ecosystem
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          FarmacoGraph Developer & B2B Portal
        </h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
          Integrate explainable biomedical knowledge, mechanism causal chains, and drug interactions
          directly into hospital EMRs, clinical decision support (CDSS), education platforms, and AI
          agents.
        </p>
      </div>

      {/* Instant API Key Generator */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Generate Instant Developer API Key</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            Free 30-Day Prototyping
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Instant access to 1,000 requests/minute across{" "}
          <code className="text-primary font-mono">/drugs</code>,{" "}
          <code className="text-primary font-mono">/interactions</code>,{" "}
          <code className="text-primary font-mono">/explain</code>, and{" "}
          <code className="text-primary font-mono">/education</code>.
        </p>

        {generatedKey ? (
          <div className="bg-muted/40 rounded-xl p-4 border space-y-3">
            <div className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> API Key Successfully Issued!
            </div>
            <div className="flex items-center justify-between gap-3 bg-background p-3 rounded-lg border font-mono text-xs">
              <span className="truncate">{generatedKey}</span>
              <button
                onClick={() => copyToClipboard(generatedKey)}
                className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? "Copied" : "Copy Key"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pass this key in request headers as{" "}
              <code className="text-foreground">X-API-Key: {generatedKey}</code> or{" "}
              <code className="text-foreground">Authorization: Bearer {generatedKey}</code>.
              {expiresAt && (
                <>
                  {" "}
                  Expires <code className="text-foreground">{expiresAt}</code>.
                </>
              )}{" "}
              Save it now — the full key is never shown again.
            </p>
          </div>
        ) : (
          <form onSubmit={handleCreateKey} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <input
              type="text"
              placeholder="Developer or App Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
              required
            />
            <input
              type="email"
              placeholder="Contact Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
              required
            />
            <input
              type="text"
              placeholder="Organization / University (Optional)"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <select
              value={intendedUse}
              onChange={(e) => setIntendedUse(e.target.value as IntendedUse)}
              className="px-3 py-2 rounded-lg border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none sm:col-span-3"
              aria-label="Intended use"
            >
              <option value="research">Research</option>
              <option value="education">Education</option>
              <option value="healthtech_demo">HealthTech demo</option>
              <option value="student_project">Student project</option>
              <option value="ai_agent">AI agent</option>
            </select>
            {error && <div className="text-xs text-red-500 col-span-full">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="sm:col-span-3 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {loading ? "Generating Credential..." : "Generate API Key Now"}
            </button>
          </form>
        )}
      </div>

      {/* Commercial & Education API Tiers */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">API Tiers & SLA Guarantees</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Student Tier */}
          <div className="p-5 rounded-2xl border bg-card space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold">EdTech & Students</h3>
              <p className="text-xs text-muted-foreground">
                For medical students, study cohorts, and flashcard learning apps.
              </p>
              <div className="text-lg font-black text-foreground pt-1">
                Free <span className="text-xs font-normal text-muted-foreground">/ Academic</span>
              </div>
              <ul className="text-xs space-y-1.5 text-muted-foreground pt-2 border-t">
                <li>• 300 req / minute rate limit</li>
                <li>• Anki TSV & Quiz Export API</li>
                <li>• Causal Mechanism DAG access</li>
                <li>• Evidence & guideline citations</li>
              </ul>
            </div>
          </div>

          {/* Developer Tier */}
          <div className="p-5 rounded-2xl border-2 border-primary bg-card space-y-3 flex flex-col justify-between shadow-xs relative">
            <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
              Most Popular
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Code2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold">Developer & Research</h3>
              <p className="text-xs text-muted-foreground">
                For independent software vendors, healthtech startups, and pharmacology researchers.
              </p>
              <div className="text-lg font-black text-foreground pt-1">Pay-as-you-grow</div>
              <ul className="text-xs space-y-1.5 text-muted-foreground pt-2 border-t">
                <li>• 1,000 req / minute rate limit</li>
                <li>• Instant API Key self-service</li>
                <li>• Full-text Neo4j Cypher subgraph query</li>
                <li>• Model Context Protocol (MCP) support</li>
                <li>• OpenAPI 3.0 Contract & SDKs</li>
              </ul>
            </div>
          </div>

          {/* Enterprise Tier */}
          <div className="p-5 rounded-2xl border bg-card space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold">Enterprise & EMR</h3>
              <p className="text-xs text-muted-foreground">
                For hospital EHRs (Epic/Cerner integration), clinical decision support, and
                simulation suites.
              </p>
              <div className="text-lg font-black text-foreground pt-1">Custom Annual</div>
              <ul className="text-xs space-y-1.5 text-muted-foreground pt-2 border-t">
                <li>• 5,000–50,000 req / minute</li>
                <li>• 99.9% Uptime SLA Guarantee</li>
                <li>• Snapshot reproducibility compliance</li>
                <li>• Optional on-premise Neo4j deployment</li>
                <li>• Dedicated biomedical curation support</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Model Context Protocol (MCP) Section */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-bold">Model Context Protocol (MCP) for Claude & ChatGPT</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          FarmacoGraph includes a native <strong>Model Context Protocol (MCP)</strong> server.
          Connect your local Claude Desktop, ChatGPT, or clinical LLM agents to the live knowledge
          graph so your AI assistant answers clinical pharmacology questions with verified,
          hallucination-free reasoning chains.
        </p>

        <div className="bg-background rounded-xl p-4 border font-mono text-xs space-y-2">
          <div className="text-muted-foreground text-[11px] font-sans font-semibold">
            Add to your Claude Desktop configuration (`claude_desktop_config.json`):
          </div>
          <pre className="text-primary overflow-x-auto text-[11px]">
            {`{
  "mcpServers": {
    "farmacograph": {
      "command": "python",
      "args": ["-m", "farmacograph.mcp.server"]
    }
  }
}`}
          </pre>
        </div>
      </div>

      {/* Code Examples */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Quick Integration (cURL)</h2>
        </div>
        <div className="bg-background rounded-xl p-4 border font-mono text-xs overflow-x-auto text-muted-foreground space-y-2">
          <div># Check Drug Interactions</div>
          <div className="text-foreground">
            curl -X POST &quot;https://farmacograph.furkanguven.space/api/v1/interactions&quot; \
            <br />
            &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br />
            &nbsp;&nbsp;-H &quot;X-API-Key: YOUR_API_KEY&quot; \<br />
            &nbsp;&nbsp;-d &apos;{`{"slugs": ["ramipril", "spironolactone"]}`}&apos;
          </div>
        </div>
      </div>
    </div>
  );
}
