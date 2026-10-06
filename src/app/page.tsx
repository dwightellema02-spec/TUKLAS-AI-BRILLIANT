import React from "react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/shared/Section";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Award,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Users,
  Compass,
  Layers,
  ChevronRight,
  ShieldCheck,
  BrainCircuit,
  HelpCircle,
  BarChart3,
  Calendar,
} from "lucide-react";

export interface LandingPageProps {
  onNavigate?: (path: string) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.pathname = path;
    }
  };

  const learningPillars = [
    {
      title: "Learn",
      tagline: "Active Exploration",
      description:
        "Understand mathematical concepts through interactive lessons, visual representations, and step-by-step thinking.",
      icon: BookOpen,
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      title: "Practice",
      tagline: "Active Problem-Solving",
      description:
        "Solve problems and receive immediate feedback to reinforce mathematical fluency and confidence.",
      icon: CheckCircle2,
      color: "text-teal-600 bg-teal-50 border-teal-100",
    },
    {
      title: "Improve",
      tagline: "Mistake Analysis",
      description:
        "Identify root-cause misconceptions and target practice in areas that need deliberate reinforcement.",
      icon: TrendingUp,
      color: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      title: "Master",
      tagline: "Demonstrated Competence",
      description:
        "Build consistent understanding across multiple signals and demonstrate long-term mathematical mastery.",
      icon: Award,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
  ];

  const curriculumTerms = [
    {
      term: "Term 1",
      title: "Numbers and Algebraic Expressions",
      status: "Initial Focus",
      statusVariant: "info" as const,
      topics: [
        "Numbers and Number Sense",
        "Set of Integers & Number Line Representation",
        "Operations on Integers (Sign Rules & Properties)",
        "Rational Numbers & Fraction Conversion",
        "Square Roots and Estimation",
      ],
    },
    {
      term: "Term 2",
      title: "Linear Equations and Inequalities",
      status: "Planned",
      statusVariant: "secondary" as const,
      topics: [
        "Algebraic Expressions & Polynomials",
        "Linear Equations in One Variable",
        "Linear Inequalities & Solution Sets",
        "Real-World Algebraic Word Problems",
      ],
    },
    {
      term: "Term 3",
      title: "Geometry and Statistics",
      status: "Planned",
      statusVariant: "secondary" as const,
      topics: [
        "Angles, Polygons, and Convexity",
        "Geometric Construction & Triangles",
        "Data Collection, Frequency Tables, & Histograms",
        "Measures of Central Tendency & Probability",
      ],
    },
  ];

  const studentSteps = [
    { step: "1", title: "Choose a Lesson", desc: "Select a topic from your MATATAG Grade 7 path." },
    { step: "2", title: "Learn the Concept", desc: "Explore concepts with visual, step-by-step models." },
    { step: "3", title: "Solve a Problem", desc: "Apply your thinking to active, varied questions." },
    { step: "4", title: "Receive Feedback", desc: "Get instant validation and identify thinking errors." },
    { step: "5", title: "Practice", desc: "Strengthen skills with adaptive follow-up challenges." },
    { step: "6", title: "Track Progress", desc: "Watch your competency and mastery grow over time." },
  ];

  const teacherHighlights = [
    "Organize lessons aligned with DepEd MATATAG curriculum",
    "Select and attach verified learning resources",
    "Assign differentiated practice activities",
    "Monitor student progress and task completion",
    "Review student mistakes and common misconceptions",
    "Analyze class-wide learning performance and competency gaps",
  ];

  return (
    <div className="flex flex-col">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-32 bg-gradient-to-b from-white via-slate-50/60 to-white border-b border-slate-200/60">
        <Container>
          <div className="max-w-3xl mx-auto text-center">
            {/* Top Pill / Status Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span>Pilot build</span>
              <span className="text-slate-400">•</span>
              <span className="text-teal-700 font-semibold">Grade 7 MATATAG Math</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
              Learn. Practice. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-teal-600 to-indigo-600">Discover.</span>
            </h1>

            {/* Supporting Text */}
            <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
              Tuklas AI is an interactive learning platform designed to help students understand concepts, practice problem-solving, and track their learning progress.
            </p>

            {/* Primary Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => handleNav("/student")}
                className="w-full sm:w-auto shadow-md shadow-blue-500/15"
              >
                <span>Start Learning</span>
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleNav("/teacher")}
                className="w-full sm:w-auto"
              >
                <span>For Teachers</span>
              </Button>
            </div>

            {/* Transparent Disclaimer Box */}
            <div className="mt-10 p-3.5 sm:p-4 rounded-xl bg-slate-100/80 border border-slate-200/80 text-xs text-slate-600 max-w-xl mx-auto flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Pilot build:</strong> the tutor uses a built-in rule-based engine unless an external AI model is configured, and has not yet been tested with real students.
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* LEARNING CONCEPT SECTION */}
      <Section
        id="how-it-works"
        badge="Pedagogical Philosophy"
        title="Active, Problem-Based Learning"
        description="Traditional learning often asks students to passively listen. Tuklas AI replaces passive reading with active, step-by-step thinking."
        centered
        className="bg-white"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {learningPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Card key={pillar.title} hoverEffect className="flex flex-col h-full bg-slate-50/40">
                <CardHeader className="pb-2">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-4 ${pillar.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {pillar.tagline}
                  </span>
                  <CardTitle className="text-xl mt-1">{pillar.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-1">
                  <CardDescription className="text-slate-600 text-sm leading-relaxed">
                    {pillar.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* STUDENT EXPERIENCE PREVIEW */}
      <Section
        id="student-flow"
        badge="Student Experience Preview"
        title="The Tuklas Learning Journey"
        description="Every topic guides students through a structured progression from first conceptual intuition to verified mastery."
        centered
        className="bg-slate-50 border-y border-slate-200/80"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {studentSteps.map((step, idx) => (
            <div
              key={step.step}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {step.step}
                  </span>
                  {idx < studentSteps.length - 1 && (
                    <span className="hidden lg:block text-slate-300 font-bold">→</span>
                  )}
                </div>
                <h3 className="font-semibold text-sm text-slate-900 mb-1">{step.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">
          * The flow a student follows through each lesson.
        </p>
      </Section>

      {/* CURRICULUM PREVIEW */}
      <Section
        id="curriculum"
        badge="Curriculum Structure Preview"
        title="Mathematics — Grade 7 (MATATAG)"
        description="Our initial scope focuses on Term 1, engineered with an extensible hierarchy to expand to all terms and subsequent grade levels."
        className="bg-white"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {curriculumTerms.map((term) => (
            <Card key={term.term} className="border-slate-200 flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {term.term}
                  </span>
                  <Badge variant={term.statusVariant}>{term.status}</Badge>
                </div>
                <CardTitle className="text-lg text-slate-900">{term.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Key Planned Topics:
                </p>
                <ul className="space-y-2.5">
                  {term.topics.map((topic) => (
                    <li key={topic} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Badge variant="outline" className="text-slate-500 border-slate-200">
            Term 1 is available now; Terms 2 and 3 are planned.
          </Badge>
        </div>
      </Section>

      {/* TEACHER EXPERIENCE PREVIEW */}
      <Section
        id="for-teachers"
        badge="Educator Platform"
        title="Designed for Teachers & Classrooms"
        description="Tuklas AI will empower mathematics teachers with deep visibility into student comprehension and diagnostic misconception insights."
        className="bg-slate-900 text-white"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-4">
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Transform classroom insights with granular mistake analysis.
            </h3>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Teachers can use Tuklas AI to:
            </p>
            <ul className="space-y-3 pt-2">
              {teacherHighlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3 text-sm text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-teal-900/80 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
            <div className="pt-4">
              <Button
                variant="accent"
                onClick={() => handleNav("/teacher")}
                className="gap-2"
              >
                <span>Open Teacher Dashboard</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Teacher Blueprint Preview Mock Card */}
          <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                <span className="font-semibold text-white text-sm">Classroom Analytics Preview</span>
              </div>
              <Badge variant="warning" className="text-[10px]">
                Illustration
              </Badge>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Class Mastery: Grade 7 - Sampaguita</span>
                  <span className="text-teal-400 font-semibold">Sample data</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-teal-500 h-2 rounded-full w-2/3" />
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-300">Top Misconception Alert</span>
                  <span className="text-amber-400 text-[10px]">Sign Rule Confusion</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Detects when students multiply magnitudes correctly but misapply negative × negative sign conventions.
                </p>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-300">Mathisipan Video Alignment</span>
                  <p className="text-slate-400 text-[11px]">Attach curated educational clips with original practice</p>
                </div>
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  Available
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* FINAL CALL TO ACTION */}
      <section className="py-16 sm:py-20 bg-blue-50 border-t border-blue-100 text-center">
        <Container>
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Ready to explore Tuklas AI?
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Explore the student, teacher, and administrator experiences.
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-3">
              <Button variant="primary" onClick={() => handleNav("/student")}>
                Student View
              </Button>
              <Button variant="outline" onClick={() => handleNav("/teacher")}>
                Teacher View
              </Button>
              <Button variant="ghost" onClick={() => handleNav("/admin")}>
                Admin View
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
