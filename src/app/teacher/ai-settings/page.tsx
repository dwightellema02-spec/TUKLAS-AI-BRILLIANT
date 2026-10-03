import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowLeft,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Shield,
  Layers,
  HelpCircle,
  MessageSquare,
  Play,
  RotateCcw,
} from "lucide-react";
import { MathText } from "@/components/ui/MathText";

export interface TeacherAISettingsPageProps {
  onNavigate?: (path: string) => void;
}

export default function TeacherAISettingsPage({ onNavigate }: TeacherAISettingsPageProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Settings State
  const [aiTutorEnabled, setAiTutorEnabled] = useState(true);
  const [maxHintLevel, setMaxHintLevel] = useState(3);
  const [model, setModel] = useState("gemini-3.8-flash");
  const [allowDirectStudentChat, setAllowDirectStudentChat] = useState(true);
  const [provider, setProvider] = useState("gemini");

  // Simulation test state
  const [testPrompt, setTestPrompt] = useState("I don't understand why -5 is smaller than -2.");
  const [simulating, setSimulating] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch("/api/ai/settings");
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setAiTutorEnabled(Boolean(json.data.aiTutorEnabled));
            setMaxHintLevel(Number(json.data.maxHintLevel) || 3);
            setModel(json.data.model || "gemini-3.8-flash");
            setAllowDirectStudentChat(Boolean(json.data.allowDirectStudentChat));
            setProvider(json.data.provider || "gemini");
          }
        }
      } catch (e) {
        console.warn("Failed to load AI settings:", e);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const token = localStorage.getItem("tuklas_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/ai/settings", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          aiTutorEnabled,
          maxHintLevel,
          model,
          allowDirectStudentChat,
          provider,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update settings.");

      setSuccessMsg("AI Tutor settings updated successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save settings.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    setSimulating(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem("tuklas_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers,
        body: JSON.stringify({
          lessonId: "lsn_01",
          skillId: "skl_02",
          studentQuery: testPrompt,
          helpLevel: "LEVEL_1_HINT",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Simulation error");
      setTestResult(json.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Simulation failed";
      setTestResult({ error: msg });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNav("/teacher")}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">AI Tutor Settings</h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                  Phase 7
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Configure Socratic tutoring rules, model parameters, and test tutor responses.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save Configuration"}</span>
          </Button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Controls Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base pb-3 border-b border-slate-100">
              <Cpu className="w-5 h-5 text-emerald-600" />
              <span>Core Tutor Behavior</span>
            </div>

            {/* AI Tutor Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-800 block">AI Tutor Availability</label>
                <p className="text-xs text-slate-500">Enable or disable AI hints and assistance across student lessons.</p>
              </div>
              <input
                type="checkbox"
                checked={aiTutorEnabled}
                onChange={(e) => setAiTutorEnabled(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
              />
            </div>

            {/* Direct Student Chat Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <label className="text-sm font-semibold text-slate-800 block">Open Student Questions</label>
                <p className="text-xs text-slate-500">Allow students to type custom math queries or explanations.</p>
              </div>
              <input
                type="checkbox"
                checked={allowDirectStudentChat}
                onChange={(e) => setAllowDirectStudentChat(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
              />
            </div>

            {/* Max Hint Level */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <label className="text-sm font-semibold text-slate-800">Maximum Progressive Hint Level</label>
              <p className="text-xs text-slate-500">
                Determines how deep the tutor will assist before requiring student practice.
              </p>
              <select
                value={maxHintLevel}
                onChange={(e) => setMaxHintLevel(Number(e.target.value))}
                className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value={1}>Level 1: Gentle Conceptual Nudge</option>
                <option value={2}>Level 2: Stronger Clue & Number Line Rule</option>
                <option value={3}>Level 3: Worked Concept & Analogy</option>
              </select>
            </div>
          </div>

          {/* Model & Security Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base pb-3 border-b border-slate-100">
              <Shield className="w-5 h-5 text-teal-600" />
              <span>Provider & Safety Policy</span>
            </div>

            {/* Provider selection */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-800">AI Provider Engine</label>
              <p className="text-xs text-slate-500">
                Select between Google Gemini AI or the offline DepEd Local Pedagogical Engine.
              </p>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="gemini">Google Gemini AI (@google/genai)</option>
                <option value="local">Local Pedagogical Rule Engine (Zero external API dependencies)</option>
              </select>
            </div>

            {/* Model Name */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <label className="text-sm font-semibold text-slate-800">Model Identifier</label>
              <p className="text-xs text-slate-500">Server-side model used for generating Socratic hints.</p>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>

            <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 text-teal-900 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1 text-teal-800">
                <Sparkles className="w-3.5 h-3.5" /> DepEd MATATAG Alignment
              </span>
              <p>
                Prompts are strictly grounded in Philippine Grade 7 Mathematics competencies. The Socratic
                instruction set prevents answer leaking and enforces age-appropriate tone.
              </p>
            </div>
          </div>
        </div>

        {/* Teacher Simulation Studio */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Teacher AI Simulation Console</h2>
            </div>
            <span className="text-xs text-slate-500">Test tutor answers in real-time</span>
          </div>

          <p className="text-xs text-slate-600">
            Simulate a Grade 7 student question for Lesson: <em>Understanding Integers</em> (Skill: <em>Comparing Integers</em>).
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Enter student question..."
              className="flex-1 text-xs sm:text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
            />
            <Button
              variant="outline"
              onClick={handleRunSimulation}
              disabled={simulating}
              className="gap-2 shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Play className="w-4 h-4 fill-indigo-600 text-indigo-600" />
              <span>{simulating ? "Generating..." : "Simulate Tutor"}</span>
            </Button>
          </div>

          {testResult && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Tutor Output Payload:</span>
                <Badge variant="outline" className="text-[10px]">
                  Provider: {testResult.providerInfo?.provider || "Engine"} • Model: {testResult.providerInfo?.model || "v1"}
                </Badge>
              </div>

              {testResult.error ? (
                <div className="text-xs text-red-600">{testResult.error}</div>
              ) : (
                <div className="space-y-2 text-xs sm:text-sm bg-white p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {testResult.message?.messageType}
                    </span>
                  </div>
                  <div className="text-slate-800 leading-relaxed">
                    <MathText content={testResult.message?.content || ""} />
                  </div>
                  {testResult.message?.guidingQuestion && (
                    <div className="mt-2 p-2 bg-emerald-50 rounded text-emerald-900 text-xs">
                      <strong>Guiding Question: </strong>
                      <MathText content={testResult.message.guidingQuestion} />
                    </div>
                  )}
                  {testResult.message?.encouragement && (
                    <div className="text-[11px] text-emerald-600 font-semibold italic">
                      {testResult.message.encouragement}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
