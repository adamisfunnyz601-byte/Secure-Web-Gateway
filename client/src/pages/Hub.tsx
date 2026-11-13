import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import {
  Gamepad2, Trophy, Target, Flame, Zap, Clock3, StickyNote, CheckSquare,
  Dices, Coins, Brain, MousePointer2, Swords, Sparkles, ArrowRight,
  RotateCcw, Play, Pause, Plus, Trash2, Star, Shield, Users, ShoppingBag,
  MessageSquare, Blocks, Timer, Lightbulb, Shuffle, Hash, Type, Palette
} from "lucide-react";

type Task = { id: number; text: string; done: boolean };
type Note = { id: number; text: string };

const STORAGE_KEY = "nexus-hub-v1";
const games = [
  { id: "clicker", name: "Neon Clicker", description: "Tap as fast as you can and build a score.", icon: MousePointer2 },
  { id: "reaction", name: "Reaction Test", description: "Wait for green, then react instantly.", icon: Zap },
  { id: "memory", name: "Memory Grid", description: "Remember the pattern and repeat it.", icon: Brain },
  { id: "rps", name: "Rock Paper Scissors", description: "Challenge the computer to a quick match.", icon: Swords },
  { id: "guess", name: "Number Hacker", description: "Crack the secret number in as few guesses as possible.", icon: Hash },
  { id: "dice", name: "Dice Arena", description: "Roll dice and chase your personal best.", icon: Dices },
  { id: "coin", name: "Coin Flip", description: "Call heads or tails and test your luck.", icon: Coins },
  { id: "typing", name: "Type Sprint", description: "Test your typing speed against the clock.", icon: Type },
] as const;

const shortcuts = [
  { title: "Messages", description: "Talk to friends and join conversations.", href: "/chat", icon: MessageSquare },
  { title: "Block Blast", description: "Play the block placement puzzle.", href: "/block-blast", icon: Blocks },
  { title: "Cosmetic Shop", description: "Browse profile decorations and emotes.", href: "/shop", icon: ShoppingBag },
  { title: "My Profile", description: "Customise your public identity.", href: "/profile", icon: Users },
  { title: "Settings", description: "Manage presence and notifications.", href: "/settings", icon: Shield },
  { title: "Web Gateway", description: "Open the built-in browsing tools.", href: "/proxy", icon: Sparkles },
] as const;

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function Hub() {
  const { user } = useAuth();
  const saved = useMemo(() => readSaved(), []);
  const [tasks, setTasks] = useState<Task[]>(Array.isArray(saved.tasks) ? saved.tasks : [
    { id: 1, text: "Play one arcade game", done: false },
    { id: 2, text: "Visit the cosmetic shop", done: false },
    { id: 3, text: "Send a message to a friend", done: false },
  ]);
  const [notes, setNotes] = useState<Note[]>(Array.isArray(saved.notes) ? saved.notes : []);
  const [noteDraft, setNoteDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [points, setPoints] = useState(Number(saved.points) || 0);
  const [streak, setStreak] = useState(Number(saved.streak) || 0);
  const [lastVisit, setLastVisit] = useState(String(saved.lastVisit || ""));
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [clicks, setClicks] = useState(0);
  const [reactionState, setReactionState] = useState<"idle" | "wait" | "go" | "done">("idle");
  const [reactionStart, setReactionStart] = useState(0);
  const [reactionResult, setReactionResult] = useState<number | null>(null);
  const [guess, setGuess] = useState("");
  const [secret, setSecret] = useState(() => Math.floor(Math.random() * 100) + 1);
  const [guessHint, setGuessHint] = useState("Pick a number from 1 to 100.");
  const [diceBest, setDiceBest] = useState(Number(saved.diceBest) || 0);
  const [coinResult, setCoinResult] = useState("");
  const [rpsResult, setRpsResult] = useState("");
  const [typingText, setTypingText] = useState("");
  const [memoryPattern, setMemoryPattern] = useState<number[]>([]);
  const [memoryInput, setMemoryInput] = useState<number[]>([]);
  const [memoryMessage, setMemoryMessage] = useState("Press start to generate a pattern.");
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, notes, points, streak, diceBest, lastVisit }));
  }, [tasks, notes, points, streak, diceBest, lastVisit]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      setStreak(lastVisit === yesterday ? value => value + 1 : 1);
      setPoints(value => value + 10);
      setLastVisit(today);
    }
  }, [lastVisit]);

  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => setFocusSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);

  useEffect(() => {
    if (focusSeconds === 0) setFocusRunning(false);
  }, [focusSeconds]);

  const completedTasks = tasks.filter(task => task.done).length;
  const addPoints = (amount: number) => setPoints(value => value + amount);
  const resetReaction = () => {
    setReactionState("wait");
    setReactionResult(null);
    window.setTimeout(() => {
      setReactionStart(Date.now());
      setReactionState(current => current === "wait" ? "go" : current);
    }, 1200 + Math.random() * 2800);
  };
  const startMemory = () => {
    const pattern = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9));
    setMemoryPattern(pattern);
    setMemoryInput([]);
    setMemoryMessage("Memorise: " + pattern.map(value => value + 1).join(" · "));\n    window.setTimeout(() => setMemoryMessage("Now repeat the 4-number pattern using the grid."), 1800);
  };
  const addMemoryNumber = (value: number) => {
    const next = [...memoryInput, value];
    setMemoryInput(next);
    if (next.length === memoryPattern.length) {
      const correct = next.every((item, index) => item === memoryPattern[index]);
      setMemoryMessage(correct ? "Perfect memory! +10 points." : "Not quite. Try another pattern.");
      if (correct) addPoints(10);
    }
  };
  const rollDice = () => {
    const value = Math.floor(Math.random() * 6) + 1;
    setDiceBest(best => Math.max(best, value));
    addPoints(value);
    setGuessHint("Dice rolled: " + value + ". You earned " + value + " points.");
  };
  const playRps = (choice: string) => {
    const options = ["Rock", "Paper", "Scissors"];
    const computer = options[Math.floor(Math.random() * 3)];
    const won = (choice === "Rock" && computer === "Scissors") || (choice === "Paper" && computer === "Rock") || (choice === "Scissors" && computer === "Paper");
    const draw = choice === computer;
    if (won) addPoints(5);
    setRpsResult("You: " + choice + " · CPU: " + computer + " — " + (draw ? "Draw" : won ? "You win! +5 points" : "CPU wins"));
  };
  const formatTime = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/80 via-slate-950 to-fuchsia-950/50 p-6 md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300"><Sparkles className="h-4 w-4" /> Community hub</div>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Your world. Your people. Your games.</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">A social and gaming hub for {user?.displayName || user?.username || "you"}. Play quick games, track personal goals and jump into the rest of NEXUS.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={Star} label="Hub points" value={points} />
              <Stat icon={Flame} label="Streak" value={streak} />
              <Stat icon={Target} label="Tasks" value={completedTasks + "/" + tasks.length} />
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-foreground">Arcade</h2><p className="text-xs text-muted-foreground">Quick games. Personal points only — no paid currency or leaderboard claims.</p></div><Gamepad2 className="h-5 w-5 text-primary" /></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {games.map(game => <button key={game.id} onClick={() => setActiveGame(game.id)} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3 text-left transition hover:border-primary/60 hover:bg-primary/5"><span className="rounded-lg bg-primary/10 p-2 text-primary"><game.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{game.name}</span><span className="block text-xs text-muted-foreground">{game.description}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground" /></button>)}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2"><CheckSquare className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">Personal quests</h2></div>
              <div className="mb-3 flex gap-2"><input value={taskDraft} onChange={event => setTaskDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && taskDraft.trim()) { setTasks(items => [...items, { id: Date.now(), text: taskDraft.trim(), done: false }]); setTaskDraft(""); } }} placeholder="Add a goal..." className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /><button onClick={() => { if (taskDraft.trim()) { setTasks(items => [...items, { id: Date.now(), text: taskDraft.trim(), done: false }]); setTaskDraft(""); } }} className="rounded-md bg-primary px-3 text-primary-foreground"><Plus className="h-4 w-4" /></button></div>
              <div className="space-y-2">{tasks.map(task => <div key={task.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={task.done} onChange={event => { setTasks(items => items.map(item => item.id === task.id ? { ...item, done: event.target.checked } : item)); if (event.target.checked && !task.done) addPoints(3); }} /><span className={task.done ? "flex-1 text-muted-foreground line-through" : "flex-1 text-foreground"}>{task.text}</span><button aria-label="Delete task" onClick={() => setTasks(items => items.filter(item => item.id !== task.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
              <p className="mt-3 text-[11px] text-muted-foreground">Complete a goal to earn 3 local hub points.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2"><Timer className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">Focus session</h2></div>
              <div className="flex items-center justify-between"><div className="font-mono text-3xl font-bold tabular-nums text-foreground">{formatTime(focusSeconds)}</div><div className="flex gap-2"><button onClick={() => setFocusRunning(value => !value)} className="rounded-md bg-primary px-3 py-2 text-primary-foreground">{focusRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button><button onClick={() => { setFocusRunning(false); setFocusSeconds(25 * 60); }} className="rounded-md border border-border px-3 py-2 text-foreground"><RotateCcw className="h-4 w-4" /></button></div></div>
              <p className="mt-2 text-xs text-muted-foreground">A 25-minute focus timer. Finish a session to claim a personal point bonus.</p>
              {focusSeconds === 0 && <button onClick={() => { addPoints(25); setFocusSeconds(25 * 60); }} className="mt-2 text-sm font-semibold text-primary">Claim +25 points and restart</button>}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2"><StickyNote className="h-5 w-5 text-primary" /><h2 className="font-bold text-foreground">Private scratchpad</h2><span className="text-xs text-muted-foreground">Saved in this browser</span></div>
          <div className="flex gap-2"><input value={noteDraft} onChange={event => setNoteDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && noteDraft.trim()) { setNotes(items => [...items, { id: Date.now(), text: noteDraft.trim() }]); setNoteDraft(""); } }} placeholder="Save an idea, reminder or game strategy..." className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /><button onClick={() => { if (noteDraft.trim()) { setNotes(items => [...items, { id: Date.now(), text: noteDraft.trim() }]); setNoteDraft(""); } }} className="rounded-md bg-primary px-3 text-primary-foreground"><Plus className="h-4 w-4" /></button></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{notes.map(note => <div key={note.id} className="flex items-start gap-2 rounded-lg bg-background p-3 text-sm text-foreground"><span className="flex-1 break-words">{note.text}</span><button onClick={() => setNotes(items => items.filter(item => item.id !== note.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
          {!notes.length && <p className="mt-3 text-xs text-muted-foreground">Nothing saved yet.</p>}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold text-foreground">Jump back in</h2><p className="text-xs text-muted-foreground">Your existing social, creative and gaming spaces.</p></div><Lightbulb className="h-5 w-5 text-primary" /></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shortcuts.map(item => <Link key={item.href} href={item.href} className="group rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/60"><div className="mb-3 flex items-center justify-between"><item.icon className="h-5 w-5 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" /></div><h3 className="font-semibold text-foreground">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></Link>)}</div>
        </section>

        {activeGame && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Arcade game"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-violet-500/30 bg-slate-950 p-5 text-white shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-violet-300">NEXUS ARCADE</p><h2 className="text-xl font-bold">{games.find(game => game.id === activeGame)?.name}</h2></div><button onClick={() => setActiveGame(null)} className="rounded-md border border-white/15 px-3 py-1 text-sm">Close</button></div>
          {activeGame === "clicker" && <div className="text-center"><p className="mb-4 text-sm text-slate-300">Click the button as many times as you can.</p><button onClick={() => setClicks(value => value + 1)} className="h-40 w-40 rounded-full border-4 border-violet-400 bg-violet-600 text-2xl font-black shadow-[0_0_50px_rgba(139,92,246,.35)] active:scale-95">TAP!</button><p className="mt-4 text-3xl font-bold">{clicks}</p><button onClick={() => { addPoints(Math.floor(clicks / 10)); setClicks(0); }} className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm">Bank score (+1 per 10 taps)</button></div>}
          {activeGame === "reaction" && <div className="text-center"><button onClick={() => { if (reactionState === "go") { const result = Date.now() - reactionStart; setReactionResult(result); setReactionState("done"); addPoints(Math.max(1, Math.floor(1000 / result))); } else if (reactionState === "wait") { setReactionState("idle"); setReactionResult(null); } else resetReaction(); }} className={"h-44 w-full rounded-xl text-xl font-black " + (reactionState === "go" ? "bg-green-500 text-black" : reactionState === "wait" ? "bg-red-600" : "bg-violet-700")}>{reactionState === "go" ? "CLICK NOW!" : reactionState === "wait" ? "WAIT FOR GREEN" : reactionState === "done" ? "TRY AGAIN" : "START TEST"}</button>{reactionResult !== null && <p className="mt-3 text-2xl font-bold">{reactionResult} ms</p>}</div>}
          {activeGame === "guess" && <div className="space-y-3"><p className="text-sm text-slate-300">{guessHint}</p><input type="number" min="1" max="100" value={guess} onChange={event => setGuess(event.target.value)} className="w-full rounded-md border border-white/20 bg-slate-900 p-3" /><button onClick={() => { const value = Number(guess); if (!Number.isInteger(value) || value < 1 || value > 100) { setGuessHint("Enter a whole number from 1 to 100."); return; } if (value === secret) { setGuessHint("Correct! +15 points. New number generated."); addPoints(15); setSecret(Math.floor(Math.random() * 100) + 1); } else setGuessHint(value < secret ? "Too low. Try higher." : "Too high. Try lower."); }} className="rounded-md bg-violet-600 px-4 py-2">Submit guess</button></div>}
          {activeGame === "dice" && <div className="text-center"><p className="mb-4 text-sm text-slate-300">Roll a six-sided dice. Personal best: {diceBest}</p><button onClick={rollDice} className="rounded-xl bg-violet-600 px-8 py-5 text-2xl font-black">ROLL DICE</button><p className="mt-3 text-xs text-slate-400">{guessHint}</p></div>}
          {activeGame === "coin" && <div className="text-center"><p className="mb-4 text-sm text-slate-300">Pick a side, then flip.</p><div className="flex justify-center gap-3"><button onClick={() => { const result = Math.random() < .5 ? "Heads" : "Tails"; setCoinResult("You called heads. It landed " + result + (result === "Heads" ? " — +5 points!" : ".")); if (result === "Heads") addPoints(5); }} className="rounded-md bg-violet-600 px-5 py-3">Call heads</button><button onClick={() => { const result = Math.random() < .5 ? "Heads" : "Tails"; setCoinResult("You called tails. It landed " + result + (result === "Tails" ? " — +5 points!" : ".")); if (result === "Tails") addPoints(5); }} className="rounded-md bg-violet-600 px-5 py-3">Call tails</button></div><p className="mt-4 text-sm">{coinResult}</p></div>}
          {activeGame === "rps" && <div className="text-center"><p className="mb-4 text-sm text-slate-300">Choose your move.</p><div className="flex justify-center gap-2">{["Rock", "Paper", "Scissors"].map(choice => <button key={choice} onClick={() => playRps(choice)} className="rounded-md bg-violet-600 px-3 py-2">{choice}</button>)}</div><p className="mt-4 text-sm">{rpsResult}</p></div>}
          {activeGame === "memory" && <div className="space-y-3 text-center"><p className="text-sm text-slate-300">{memoryMessage}</p><button onClick={startMemory} className="rounded-md bg-violet-600 px-4 py-2">Start pattern</button><div className="grid grid-cols-3 gap-2">{Array.from({ length: 9 }, (_, index) => <button key={index} onClick={() => addMemoryNumber(index)} className="aspect-square rounded-lg border border-violet-400/30 bg-violet-500/15 text-lg font-bold hover:bg-violet-500/40">{index + 1}</button>)}</div></div>}
          {activeGame === "typing" && <div className="space-y-3"><p className="rounded-lg bg-slate-900 p-3 text-sm leading-6">NEXUS is where friends meet, play games and create their own corner of the internet.</p><textarea value={typingText} onChange={event => setTypingText(event.target.value)} placeholder="Type the sentence above..." className="min-h-28 w-full rounded-md border border-white/20 bg-slate-900 p-3 text-sm" /><p className="text-xs text-slate-400">Characters typed: {typingText.length}. Match the sentence exactly to earn 20 points.</p><button onClick={() => { if (typingText.trim() === "NEXUS is where friends meet, play games and create their own corner of the internet.") { addPoints(20); setTypingText(""); setGuessHint("Perfect typing! +20 points."); } else setGuessHint("Not quite — check the sentence and punctuation."); }} className="rounded-md bg-violet-600 px-4 py-2">Check typing</button><p className="text-sm">{guessHint}</p></div>}
        </div></div>}
      </div>
    </Layout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return <div className="min-w-[82px] rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white"><Icon className="mb-1 h-4 w-4 text-violet-300" /><div className="text-lg font-bold tabular-nums">{value}</div><div className="text-[10px] text-slate-300">{label}</div></div>;
}
