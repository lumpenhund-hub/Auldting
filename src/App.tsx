/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  HelpCircle, 
  Sparkles, 
  Clock, 
  PiggyBank, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Award, 
  Info, 
  RotateCw, 
  Send, 
  ShieldAlert, 
  ChevronRight,
  TrendingDown,
  Coins,
  MapPin,
  Check,
  AlertCircle
} from 'lucide-react';
import { GameState, HealthType, FranchiseType, MedicalScenario, GameScreen } from './types';

// Accurate Swiss Insurance Premium structure
// Based on typical Swiss average models (inc. accident coverage)
const PREMIUMS = {
  300: 4320,  // CHF 4'320.- constant annual premiums (equivalent to ~CHF 360/month)
  2500: 3180, // CHF 3'180.- constant annual premiums (equivalent to ~CHF 265/month)
};

// Pedogogically ideal scenarios representing different medical pathways in Switzerland
const SCENARIOS: Record<HealthType, MedicalScenario> = {
  Gesund: {
    title: 'Sehr gute Gesundheit (Kaum Kosten)',
    costs: 200, // CHF 200 worth of medication or brief pharmacist advice
    desc: 'Du bist das ganze Jahr über kerngesund geblieben. Du hattest lediglich einen kurzen Besuch in der Apotheke für Hustensaft und eine Vorsorgekontrolle beim Zahnarzt.',
  },
  Mix: {
    title: 'Mittlerer Krankheitsverlauf (Grippe & Physio)',
    costs: 1200, // CHF 1'200 swiss health costs
    desc: 'Eine unerwartete Influenza-Grippe bringt dich zum Hausarzt. Dazu kommen 4 verordnete Sitzungen Physiotherapie nach dem Umknicken beim Joggen auf dem Vitaparcours.',
  },
  Chronisch: {
    title: 'Anhaltende chronische Behandlung (Hohe Kosten)',
    costs: 12000, // CHF 12'000 swiss health costs (high end medical)
    desc: 'Ein chronisches Leiden erfordert eine regelmässige medizinische Betreuung, regelmässige Bluttests, ein MRT im Kantonsspital und teure, verschreibungspflichtige Medikamente.',
  },
};

// Satisfying sound synthesizer helpers for play interactive feedback
const playChimeSound = (type: 'success' | 'click' | 'error' | 'win') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'win') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Web audio blocked
  }
};

const AVAILABLE_TOPICS = [
  "Steuererklärung ausfüllen & kantonale Abzüge 📝",
  "Mietvertrag, Mietkaution & Wohnungsabnahme 🏠",
  "Hausrat- & Privathaftpflichtversicherung (Sinn vs. Unsinn) 🛡️",
  "Schweizer BVG Pensionskasse & AHV-Rentenschätzung (Säulen 1 & 2) 📊",
  "Optimales Monatsbudget (Ausgabe-Prioritäten & Notgroschen) 📈"
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('map');
  
  // Persistent game state
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem('adulting_state_v1.2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return {
      gameProgress: 1,
      healthType: null,
      selectedFranchise: null,
      selected3a: null,
      currentBadge: '🌱 Franchise-Frischling',
    };
  });

  const mapScrollRef = useRef<HTMLDivElement>(null);

  // Level 1 variables
  const [l1QuizAnswer, setL1QuizAnswer] = useState<string | null>(null);
  const [l1Feedback, setL1Feedback] = useState<{ isCorrect: boolean; text: string } | null>(null);

  // Level 2 variables
  const [l2QuizAnswer, setL2QuizAnswer] = useState<string | null>(null);
  const [l2Feedback, setL2Feedback] = useState<{ isCorrect: boolean; text: string } | null>(null);

  // Email collector
  const [userEmail, setUserEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // New feedback system states
  const [helpsUnderstand, setHelpsUnderstand] = useState<'ja' | 'nein' | null>(null);
  const [wantsMoreLevels, setWantsMoreLevels] = useState<'ja' | 'nein' | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<'ja' | 'nein' | null>(null);
  const [votedTopics, setVotedTopics] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Save game state
  useEffect(() => {
    localStorage.setItem('adulting_state_v1.2', JSON.stringify(gameState));
  }, [gameState]);

  const handleNav = (screen: GameScreen) => {
    playChimeSound('click');
    setCurrentScreen(screen);
  };

  // Mathematical Cost calculations set by Swiss Bundesamt für Gesundheit (BAG)
  // Patient plays the franchise, plus 10% of remainder up to exact limit CHF 700.- Selbstbehalt
  const calculateSwissCosts = (costs: number, franchise: FranchiseType) => {
    const paidFranchise = Math.min(franchise, costs);
    const remainder = Math.max(0, costs - paidFranchise);
    const copay = Math.min(700, remainder * 0.10);
    return paidFranchise + copay;
  };

  const handleReset = () => {
    playChimeSound('error');
    setGameState({
      gameProgress: 1,
      healthType: null,
      selectedFranchise: null,
      selected3a: null,
      currentBadge: '🌱 Franchise-Frischling',
    });
    setL1QuizAnswer(null);
    setL1Feedback(null);
    setL2QuizAnswer(null);
    setL2Feedback(null);
    setIsSubmitted(false);
    setUserEmail('');
    setCurrentScreen('map');
  };

  const handleStartLevel = () => {
    if (gameState.gameProgress === 1) {
      handleNav('l1-setup');
    } else if (gameState.gameProgress === 2) {
      handleNav('l2-setup');
    } else {
      handleNav('l2-complete');
    }
  };

  const handleL1Simulate = () => {
    if (!gameState.healthType || !gameState.selectedFranchise) {
      playChimeSound('error');
      alert('Bitte wähle zuerst deinen Gesundheitsstatus UND deine Franchise aus!');
      return;
    }

    const sc = SCENARIOS[gameState.healthType];
    const targetFranchise = gameState.selectedFranchise;
    const alternativeFranchise = targetFranchise === 2500 ? 300 : 2500;

    const myCosts = PREMIUMS[targetFranchise] + calculateSwissCosts(sc.costs, targetFranchise);
    const altCosts = PREMIUMS[alternativeFranchise] + calculateSwissCosts(sc.costs, alternativeFranchise);

    const isWinner = myCosts <= altCosts;

    let initialBadge = '🌸 Franchise-Schüler';
    if (gameState.healthType === 'Mix' && targetFranchise === 2500) {
      initialBadge = '🧠 Franchise-Stratege';
    } else if (isWinner) {
      initialBadge = '🦊 Franchise-Fuchs';
    } else {
      initialBadge = '🩹 Franchise-Pechvogel';
    }

    setGameState(prev => ({
      ...prev,
      currentBadge: initialBadge
    }));

    if (isWinner) {
      playChimeSound('win');
    } else {
      playChimeSound('error');
    }

    handleNav('l1-result');
  };

  const handleAnswerL1Quiz = (option: 'A' | 'B') => {
    setL1QuizAnswer(option);
    if (option === 'A') {
      playChimeSound('success');
      setL1Feedback({
        isCorrect: true,
        text: 'Sensationell! Eine mittlere Franchise (wie 1000 oder 1500) ist statistisch fast immer unrentabel. Der Prämienrabatt ist zu gering für das Risiko, das man trägt. Das Bundesamt für Gesundheit (BAG) empfiehlt daher für Erwachsene ausschliesslich die Wahl von 300 oder 2500.'
      });
      
      // Update badge to signify strategy skill
      setGameState(prev => ({
        ...prev,
        currentBadge: '🏥 Healthcare-Boss'
      }));
    } else {
      playChimeSound('error');
      setL1Feedback({
        isCorrect: false,
        text: 'Leider nein. Die Franchise 300 ist im Ernstfall nicht die schlechteste, sondern für chronisch kranke Personen die finanziell optimalste Wahl, da sie hohe Kosten schnell auffängt.'
      });
    }
  };

  const completeLevel1 = () => {
    setGameState(prev => ({
      ...prev,
      gameProgress: 2
    }));
    handleNav('map');
  };

  const handleL2Simulate = () => {
    if (gameState.selected3a === null) {
      playChimeSound('error');
      alert('Bitte selektiere einen Betrag für deine Säule 3a!');
      return;
    }

    let nextBadge = gameState.currentBadge;
    if (gameState.selected3a === 7258) {
      nextBadge = '👑 Altersvorsorge-Prinz';
    } else if (gameState.selected3a === 3600) {
      nextBadge = '⚖️ Cleverer Absetzer';
    } else {
      nextBadge = '💸 Steuer-Schenker';
    }

    setGameState(prev => ({
      ...prev,
      currentBadge: nextBadge
    }));

    playChimeSound('win');
    handleNav('l2-result');
  };

  const handleAnswerL2Quiz = (option: 'A' | 'B') => {
    setL2QuizAnswer(option);
    if (option === 'B') {
      playChimeSound('success');
      setL2Feedback({
        isCorrect: true,
        text: 'Perfekt gelöst! Nach den gesetzlichen Vorgaben des Bundesamtes für Sozialversicherungen (BSV) ist die Säule 3a zweckgebunden auf die Pensionierung ausgelegt. Vorzeitige Auszahlungen sind gesetzlich streng reglementiert und etwa für den Erwerb von Wohneigentum (WEG), die Aufnahme einer selbstständigen Erwerbstätigkeit oder die endgültige Auswanderung möglich.'
      });

      // Ultimate badge
      setGameState(prev => ({
        ...prev,
        currentBadge: '🏆 Schweizer Adulting-Meister'
      }));
    } else {
      playChimeSound('error');
      setL2Feedback({
        isCorrect: false,
        text: 'Falsch! Die Säule 3a ist steuerlich geschützt und stark gebunden. Du darfst das Geld nicht für alltägliche Konsumgüter, private Leasingraten oder Ferien beziehen.'
      });
    }
  };

  const completeLevel2 = () => {
    setGameState(prev => ({
      ...prev,
      gameProgress: 3
    }));
    handleNav('l2-complete');
  };

  // L1 details calculation
  const getL1SimulationResults = () => {
    if (!gameState.healthType || !gameState.selectedFranchise) return null;
    const sc = SCENARIOS[gameState.healthType];
    const chosenFranchise = gameState.selectedFranchise;
    const alternativeFranchise = chosenFranchise === 2500 ? 300 : 2500;

    const chosenPremium = PREMIUMS[chosenFranchise];
    const chosenMedicalCost = calculateSwissCosts(sc.costs, chosenFranchise);
    const chosenTotal = chosenPremium + chosenMedicalCost;

    const altPremium = PREMIUMS[alternativeFranchise];
    const altMedicalCost = calculateSwissCosts(sc.costs, alternativeFranchise);
    const altTotal = altPremium + altMedicalCost;

    const userIsCheaper = chosenTotal <= altTotal;
    const diff = Math.abs(altTotal - chosenTotal);

    return {
      title: sc.title,
      costs: sc.costs,
      desc: sc.desc,
      chosenFranchise,
      alternativeFranchise,
      chosenPremium,
      chosenMedicalCost,
      chosenTotal,
      altPremium,
      altMedicalCost,
      altTotal,
      userIsCheaper,
      diff,
    };
  };

  const l1ResultStats = getL1SimulationResults();
  
  // Tax savings progression (using a conservative Schweizer average Grenzsteuersatz of 15%)
  const calculatedTaxSavingsL2 = gameState.selected3a ? Math.round(gameState.selected3a * 0.15) : 0;

  return (
    <div id="app-wrapper" className="min-h-screen bg-slate-900 font-sans text-slate-800 flex flex-col justify-center items-center p-4">
      
      {/* Simulation layout container imitating Swiss alpine design */}
      <div id="game-phone-container" className="bg-white w-full max-w-md rounded-[2.25rem] shadow-2xl overflow-hidden border-8 border-slate-950 flex flex-col min-h-[710px] relative">
        
        {/* Notch / Speaker header */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-950 h-5 w-40 rounded-b-2xl z-30 flex items-center justify-center">
          <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
        </div>

        {/* TOP STATUS BAR */}
        <div className="bg-slate-950 text-slate-300 pt-7 px-6 pb-2.5 flex justify-between items-center text-xs border-b border-slate-900 font-mono select-none">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
            <span>PROGRESSE: QUEST {gameState.gameProgress}/2</span>
          </div>
          <div className="font-bold text-[10px] text-red-500 bg-slate-900 px-2 py-0.5 rounded tracking-wide">
            EIDGENÖSSISCHE VORSORGE
          </div>
        </div>

        {/* HERO BADGE HEADER */}
        <div className="bg-slate-900 text-white p-3 px-6 flex items-center justify-between border-b border-slate-800 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Aktueller Rang</span>
            <span id="dash-badge" className="text-xs font-bold text-amber-400 mt-0.5 flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-500" />
              {gameState.currentBadge}
            </span>
          </div>
          <button 
            id="reset-game-btn" 
            onClick={handleReset}
            className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 rounded text-[9px] text-slate-300 transition-all active:scale-95 flex items-center gap-1 font-mono border border-slate-700/60 cursor-pointer"
          >
            <RotateCw className="w-2.5 h-2.5" /> RE-START
          </button>
        </div>

        {/* VIEWS SWITCHPORT CONTAINER */}
        <div id="main-screens-viewport" className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            
            {/* SCREEN: MAP PATH */}
            {currentScreen === 'map' && (
              <motion.div 
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col justify-between"
              >
                {/* Header title cards info */}
                <div className="p-4 px-6 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 font-display tracking-tight uppercase">
                      Schweizer Sparpfad 🇨🇭
                    </h2>
                    <p className="text-[11px] text-slate-500 font-sans">Schritt für Schritt durch die Schweizer Finanzwelt</p>
                  </div>
                  <div className="bg-rose-50 text-red-650 rounded-full p-2">
                    <Sparkles className="w-3.5 h-3.5 text-red-600" />
                  </div>
                </div>

                {/* VISUAL MAP MAP SCROLLER */}
                <div 
                  id="map-scroll-container" 
                  ref={mapScrollRef}
                  className="w-full overflow-x-auto overflow-y-hidden py-10 bg-gradient-to-b from-sky-50 to-neutral-100 border-b border-slate-200 relative custom-scrollbar flex items-center snap-x snap-mandatory scroll-smooth"
                >
                  <div className="w-[660px] h-40 relative px-8 flex items-center select-none">
                    
                    {/* Alps topography banner back decoration */}
                    <div className="absolute top-1 left-24 text-slate-200/50 opacity-30 font-bold font-display text-4xl pointer-events-none select-none tracking-widest uppercase">
                      HELVETIA
                    </div>

                    {/* Simple geometric road lines path connector */}
                    <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-10 pointer-events-none stroke-slate-300 stroke-[5] fill-none stroke-dasharray-[8,8]">
                      <path d="M 30,15 C 120,55, 200,-15, 300,20 C 400,55, 480,-15, 630,15" />
                    </svg>

                    {/* STATION A: START POINT */}
                    <div className="absolute left-6 bottom-10 text-center w-24 flex flex-col items-center snap-center">
                      <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-400 flex items-center justify-center text-[10px] font-black text-slate-600 shadow-sm">
                        START
                      </div>
                      <span className="text-[9px] text-slate-500 font-bold mt-1 uppercase font-mono tracking-wider">Berufseinstieg</span>
                    </div>

                    {/* STATION B: LEVEL 1 KRANKENKASSE */}
                    <div className="absolute left-64 bottom-6 text-center w-28 flex flex-col items-center z-10 snap-center">
                      {gameState.gameProgress > 1 ? (
                        <div className="mb-1 flex items-center gap-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
                          <Check className="w-2.5 h-2.5 text-emerald-600" /> GELÖST
                        </div>
                      ) : (
                        <div className="bg-amber-100 border border-amber-300 text-amber-950 text-[8px] font-bold px-1.5 py-0.5 rounded shadow mb-1 inline-block animate-bounce font-mono">
                          QUEST 1
                        </div>
                      )}
                      
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-md transition-all duration-300 ${gameState.gameProgress > 1 ? 'bg-emerald-100 border-2 border-emerald-500' : 'bg-white border-2 border-red-500 scale-105'}`}>
                        🏥
                      </div>
                      <div className="font-bold text-[11px] text-slate-700 mt-1 font-display">Krankenkasse</div>
                      <div className="text-[8px] text-slate-400 font-mono tracking-widest font-semibold uppercase">Franchise-Auswahl</div>
                    </div>

                    {/* STATION C: LEVEL 2 STEUERAMT */}
                    <div className="absolute left-[440px] bottom-6 text-center w-28 flex flex-col items-center z-10 snap-center">
                      {gameState.gameProgress > 2 ? (
                        <div className="mb-1 flex items-center gap-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
                          <Check className="w-2.5 h-2.5 text-emerald-600" /> GELÖST
                        </div>
                      ) : gameState.gameProgress === 2 ? (
                        <div className="bg-amber-100 border border-amber-300 text-amber-950 text-[8px] font-bold px-1.5 py-0.5 rounded shadow mb-1 inline-block animate-bounce font-mono">
                          QUEST 2
                        </div>
                      ) : null}

                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-md transition-all duration-300 ${gameState.gameProgress > 2 ? 'bg-emerald-100 border-2 border-emerald-500' : gameState.gameProgress === 2 ? 'bg-white border-2 border-red-500 scale-105' : 'bg-slate-100 border border-slate-200 grayscale opacity-60'}`}>
                        🏛️
                      </div>
                      <div className="font-bold text-[11px] text-slate-700 mt-1 font-display">Steueramt</div>
                      <div className="text-[8px] text-slate-400 font-mono tracking-widest font-semibold uppercase">Säule 3a Trick</div>
                    </div>

                    {/* REPOSITION PLAYER FLAG ON THE GAME BOARD */}
                    <div 
                      id="player-flag-overlay" 
                      className={`absolute text-3xl z-20 pointer-events-none drop-shadow transition-all duration-500 bottom-[45px] ${
                        gameState.gameProgress === 1 ? 'left-[16%]' : gameState.gameProgress === 2 ? 'left-[43%]' : 'left-[70%]'
                      }`}
                    >
                      📍
                    </div>
                  </div>
                </div>

                {/* ACTIONS CARD FOOTER */}
                <div className="p-6 bg-white border-t border-slate-200 text-center flex flex-col justify-between">
                  <div className="mb-4">
                    <span className="text-[9px] text-red-600 font-bold uppercase tracking-widest font-mono flex items-center justify-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> NÄCHSTE STATION
                    </span>
                    <div id="map-instruction" className="text-xs text-slate-700 font-bold mt-1.5 leading-relaxed px-1">
                      {gameState.gameProgress === 1 
                        ? 'Quest 1: Tritt vor die Tür der Krankenkasse. Welches Gesundheitsprofil wählst du beim Healthcare-Poker?' 
                        : gameState.gameProgress === 2 
                        ? 'Quest 2: Tritt dem Steueramt gegenüber. Wie viel deiner Ersparnisse bringst du dieses Jahr steuerabsetzbar in Sicherheit?' 
                        : 'Sensationell! Du hast alle gegenwärtigen Quest-Missionen bestanden. Hier geht es zur Abschlussbestätigung.'}
                    </div>
                  </div>

                  <button 
                    id="btn-start-level" 
                    onClick={handleStartLevel}
                    className={`w-full py-3.5 rounded-xl font-bold font-display shadow-md transition-all text-xs active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${gameState.gameProgress === 1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-900 hover:bg-slate-950 text-white'}`}
                  >
                    {gameState.gameProgress === 1 
                      ? 'Quest 1 starten 🏥' 
                      : gameState.gameProgress === 2 
                      ? 'Quest 2 starten 🏛️' 
                      : 'Abschlussurkunde ansehen 🏆'} <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}


            {/* SCREEN: LEVEL 1 HEALTHCARE CHOOSE OPTIONS */}
            {currentScreen === 'l1-setup' && (
              <motion.div 
                key="l1-setup"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="flex-1 flex flex-col justify-between p-6 overflow-y-auto custom-scrollbar"
              >
                <div>
                  {/* Header Title bar */}
                  <div className="bg-red-650 bg-red-600 text-white p-4 -mx-6 -mt-6 mb-5 text-center shadow-sm relative">
                    <button 
                      onClick={() => handleNav('map')} 
                      className="absolute left-4 top-4 text-xs font-bold bg-red-700 hover:bg-red-800 px-2 py-0.5 rounded text-white active:scale-95 transition-all"
                    >
                      ← Pfad
                    </button>
                    <h1 className="text-xs font-black tracking-widest font-display text-white uppercase select-none">Quest 1: Healthcare-Poker</h1>
                    <p className="text-[9px] text-red-100 font-mono mt-0.5 uppercase tracking-wider">Krankenkassen Franchise-Optimum</p>
                  </div>

                  {/* Didaktisches Prinzip: Von Gross nach Klein Box */}
                  <div className="bg-slate-100 border-l-4 border-red-500 rounded-r-xl p-3.5 mb-5 space-y-2 text-[10.5px]">
                    <div className="font-semibold text-slate-950 uppercase tracking-wider text-[9px] text-red-650 font-mono">
                      Didaktischer Pfad: KVG Grundversicherung
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">🌍 1. Übergeordneter Kontext (Das Grosse):</span>
                      Die gesetzliche Krankenkasse (obligatorische Krankenpflegeversicherung) sichert deine finanzielle Existenz in der Schweiz bei Krankheit und Unfall ab. Sie schützt dich vor existenziellen Behandlungs- und Spitalkosten.
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">🛡️ 2. Das spezifische Instrument (Das Mittlere):</span>
                      Die gesetzliche Grundversicherung (nach KVG) garantiert allen Versicherten die identische medizinische Grundversorgung und ist für alle Einwohner obligatorisch.
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">⚙️ 3. Die Stellschraube (Das Kleine):</span>
                      Deine wichtigste Stellschraube ist die Franchise (Schweizer Wahlmodelle: CHF 300 vs. CHF 2500). Hiermit steuerst du das Verhältnis von monatlichen festen Prämienzahlungen zu deiner eigenen Kostenbeteiligung im Krankheitsfall.
                    </div>
                  </div>

                  {/* PROFILE SELECTION STEP */}
                  <h2 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="w-4.5 h-4.5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-mono">1</span>
                    Wer bist du gesundheitlich?
                  </h2>
                  <p className="text-slate-500 text-[10px] mb-3 leading-relaxed">
                    Wähle dein fiktives Profil für das laufende Jahr. Am Jahresende rechnen wir deine echten Krankheitskosten ab.
                  </p>

                  <div className="space-y-2 mb-4">
                    <button 
                      id="btn-Gesund"
                      onClick={() => { playChimeSound('click'); setGameState(prev => ({ ...prev, healthType: 'Gesund' })); }}
                      className={`poker-card w-full ${gameState.healthType === 'Gesund' ? 'card-active' : ''}`}
                    >
                      <span className="text-2xl filter drop-shadow">🏃‍♂️</span>
                      <div>
                        <div className="font-bold text-slate-800 text-[11px]">Sehr gute Gesundheit</div>
                        <div className="text-[9px] text-slate-500">Fast keine Arztbesuche oder rezeptpflichtige Medikamente das ganze Jahr.</div>
                      </div>
                    </button>

                    <button 
                      id="btn-Mix"
                      onClick={() => { playChimeSound('click'); setGameState(prev => ({ ...prev, healthType: 'Mix' })); }}
                      className={`poker-card w-full ${gameState.healthType === 'Mix' ? 'card-active' : ''}`}
                    >
                      <span className="text-2xl filter drop-shadow">🤧</span>
                      <div>
                        <div className="font-bold text-slate-800 text-[11px]">Mittlerer Mix-Verlauf</div>
                        <div className="text-[9px] text-slate-500">Ab und zu mal ein Arztbesuch wegen Grippe oder Physio-Verschreibungen.</div>
                      </div>
                    </button>

                    <button 
                      id="btn-Chronisch"
                      onClick={() => { playChimeSound('click'); setGameState(prev => ({ ...prev, healthType: 'Chronisch' })); }}
                      className={`poker-card w-full ${gameState.healthType === 'Chronisch' ? 'card-active' : ''}`}
                    >
                      <span className="text-2xl filter drop-shadow">💊</span>
                      <div>
                        <div className="font-bold text-slate-800 text-[11px]">Anhaltende Behandlung (Chronisch)</div>
                        <div className="text-[9px] text-slate-500">Regelmässige Behandlungen, MRT-Scans oder teure Dauer-Medikamente.</div>
                      </div>
                    </button>
                  </div>

                  {/* FRANCHISE SELECTION STEP */}
                  <h2 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="w-4.5 h-4.5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-mono">2</span>
                    Deine Jahres-Franchise
                  </h2>
                  <p className="text-slate-500 text-[10px] mb-3 leading-relaxed">
                    Der Betrag, den du selbst an die Arztkosten zusteuern musst, bevor die Kasse zahlt.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <button 
                      id="btn-2500"
                      onClick={() => { playChimeSound('click'); setGameState(prev => ({ ...prev, selectedFranchise: 2500 })); }}
                      className={`poker-grid-card ${gameState.selectedFranchise === 2500 ? 'card-active' : ''}`}
                    >
                      <div className="text-base font-black text-slate-900 font-mono">CHF 2'500</div>
                      <div className="text-[9px] text-slate-500 mt-0.5 leading-relaxed font-semibold uppercase">
                        Hohes Risiko<br />
                        <span className="text-green-700 bg-green-50 px-1 rounded">Tiefe Fix-Prämie</span>
                      </div>
                    </button>

                    <button 
                      id="btn-300"
                      onClick={() => { playChimeSound('click'); setGameState(prev => ({ ...prev, selectedFranchise: 300 })); }}
                      className={`poker-grid-card ${gameState.selectedFranchise === 300 ? 'card-active' : ''}`}
                    >
                      <div className="text-base font-black text-slate-900 font-mono">CHF 300</div>
                      <div className="text-[9px] text-slate-500 mt-0.5 leading-relaxed font-semibold uppercase">
                        Sicherheitsnetz<br />
                        <span className="text-red-600 bg-red-50 px-1 rounded">Hohe Fix-Prämie</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-6 pt-2">
                  <button 
                    onClick={handleL1Simulate}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow focus:outline-none transition active:scale-98 text-xs cursor-pointer"
                  >
                    Simulation berechnen 🎲
                  </button>
                </div>
              </motion.div>
            )}


            {/* SCREEN: LEVEL 1 SIMULATION DETAILED RESULTS */}
            {currentScreen === 'l1-result' && l1ResultStats && (
              <motion.div 
                key="l1-result"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="flex-1 flex flex-col justify-between p-6 overflow-y-auto custom-scrollbar font-sans"
              >
                <div className="space-y-4">
                  {/* Result Title */}
                  <div className="bg-slate-900 text-white p-4 -mx-6 -mt-6 mb-3 text-center shadow-sm relative">
                    <h2 className="text-[9px] uppercase tracking-widest font-mono text-slate-400">Jahresabrechnung</h2>
                    <p className="font-bold text-xs font-display">{l1ResultStats.title}</p>
                  </div>

                  {/* Fact Case narrative */}
                  <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3.5 text-center">
                    <p className="text-[10px] text-slate-600 italic leading-relaxed">
                      "{l1ResultStats.desc}"
                    </p>
                    <div className="mt-2 text-[10px] text-slate-800 font-bold">
                      Gerechnete Behandlungskosten: CHF {l1ResultStats.costs.toLocaleString('de-CH')}.-
                    </div>
                  </div>

                  {/* Precise Costs Matrix Column comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-xl border text-center ${l1ResultStats.userIsCheaper ? 'bg-emerald-50 border-emerald-250 shadow-sm' : 'bg-slate-100 border-slate-200'}`}>
                      <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold font-mono">Franchise {l1ResultStats.chosenFranchise}</div>
                      <div className="text-sm font-black text-slate-900 mt-1">CHF {l1ResultStats.chosenTotal.toLocaleString('de-CH')}.-</div>
                      <div className="text-[8px] text-slate-500 mt-1 divide-y divide-slate-200/60 font-mono text-left max-w-[120px] mx-auto">
                        <div className="pb-0.5">Grundprämie: CHF {l1ResultStats.chosenPremium}</div>
                        <div className="pt-0.5 font-semibold">Arztbeteiligung: CHF {l1ResultStats.chosenMedicalCost}</div>
                      </div>
                    </div>

                    <div className={`p-3 rounded-xl border text-center ${!l1ResultStats.userIsCheaper ? 'bg-emerald-50 border-emerald-250 shadow-sm' : 'bg-slate-100 border-slate-200'}`}>
                      <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold font-mono">Franchise {l1ResultStats.alternativeFranchise}</div>
                      <div className="text-sm font-black text-slate-900 mt-1">CHF {l1ResultStats.altTotal.toLocaleString('de-CH')}.-</div>
                      <div className="text-[8px] text-slate-500 mt-1 divide-y divide-slate-200/60 font-mono text-left max-w-[120px] mx-auto">
                        <div className="pb-0.5">Grundprämie: CHF {l1ResultStats.altPremium}</div>
                        <div className="pt-0.5 font-semibold">Arztbeteiligung: CHF {l1ResultStats.altMedicalCost}</div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[9px] text-center text-slate-500 font-mono italic px-2 leading-tight">
                    * Die hier gerechneten Krankenkassenprämien sind ein simulierter Schweizer Durchschnittswert (inkl. Unfalldeckung).
                  </div>

                  {/* Financial result badge without any bloated text */}
                  <div className={`py-3 px-4 rounded-xl text-center text-xs font-bold leading-normal border shadow-sm ${l1ResultStats.userIsCheaper ? 'bg-green-100 text-green-900 border-green-200' : 'bg-red-100 text-red-900 border-red-200'}`}>
                    {l1ResultStats.userIsCheaper ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Coins className="w-4 h-4 text-green-700 animate-bounce" />
                        Spargewinn erzielt: +CHF {l1ResultStats.diff.toLocaleString('de-CH')}.- !
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <TrendingDown className="w-4 h-4 text-red-700" />
                        Mehrkosten gezahlt: -CHF {l1ResultStats.diff.toLocaleString('de-CH')}.- gegenüber Alternative.
                      </span>
                    )}
                  </div>

                  {/* Explanatory notes by Bundesamt für Gesundheit BAG */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                    <h4 className="font-bold text-blue-950 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1 mb-1">
                      <Info className="w-3.5 h-3.5 text-blue-800" /> Eidgenössische Faustregel (BAG)
                    </h4>
                    <p className="text-[10px] text-blue-950 leading-relaxed font-sans">
                      Sämtliche Erwachsenen-Franchisen sind gesetzlich geregelt. Mathematisch lohnt sich der Wechsel nur an zwei Endpunkten:
                    </p>
                    <ul className="list-disc pl-3 mt-1.5 text-[9.5px] text-blue-900 space-y-1">
                      <li>Erwartete Behandlungskosten <strong>unter CHF 2'000.-</strong> pro Jahr? Wähle immer <strong>Franchise 2500</strong> (maximaler Prämienrabatt).</li>
                      <li>Erwartete Behandlungskosten <strong>über CHF 2'000.-</strong> pro Jahr? Wähle immer <strong>Franchise 300</strong> (Sicherheitsnetz greift sofort).</li>
                    </ul>
                  </div>

                </div>

                <div className="mt-8">
                  <button 
                    onClick={() => handleNav('l1-quiz')}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-3.5 rounded-xl shadow transition text-xs flex items-center justify-center gap-1"
                  >
                    <span>Zur Boss-Frage vorrücken 🧠</span> <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}


            {/* SCREEN: LEVEL 1 BOSS QUESTION ON A SEPARATE SCREEN */}
            {currentScreen === 'l1-quiz' && (
              <motion.div 
                key="l1-quiz"
                initial={{ opacity: 0, x: 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -25 }}
                className="flex-1 flex flex-col justify-between p-6 overflow-y-auto custom-scrollbar"
              >
                <div>
                  {/* Header */}
                  <div className="bg-slate-950 text-amber-400 p-4 -mx-6 -mt-6 mb-5 text-center shadow">
                    <span className="text-[8px] uppercase tracking-widest font-mono text-slate-500 block">Checkpoint</span>
                    <h1 className="text-xs font-black tracking-widest font-display uppercase flex items-center justify-center gap-1.5">
                      🧠 BOSS-FRAGE: KRANKENKASSEN-GEHEIMNIS
                    </h1>
                  </div>

                  <p className="text-slate-600 text-[10.5px] mb-4 leading-relaxed text-center px-1 font-sans">
                    Zeige, dass du die didaktische Logik der Krankenkassen-Franchisen durchdrungen hast, um fortzufahren.
                  </p>

                  <h3 className="font-bold text-slate-900 text-xs text-center mb-5 leading-normal bg-slate-50 p-3 rounded-xl border border-slate-200">
                    Welche Franchise-Option ist bei einem geringen Behandlungsrisiko von unter CHF 2'000.- pro Jahr rechnerisch am unvorteilhaftesten?
                  </h3>

                  {/* Large tap answer cards options */}
                  <div className="space-y-3">
                    <button 
                      onClick={() => handleAnswerL1Quiz('B')}
                      className={`quiz-card w-full ${l1QuizAnswer === 'B' ? 'card-active' : ''}`}
                    >
                      <div className="font-semibold text-[11px] text-slate-805">
                        ❌ Die Wahl der Minimalfranchise von CHF 300 bei voller Gesundheit
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1">
                        Weil man dort ununterbrochen hohe Fixprämien zahlt, selbst wenn man komplett gesund bleibt. Doch dies ist zumindest im Behandlungsfall eine Absicherung.
                      </p>
                    </button>

                    <button 
                      onClick={() => handleAnswerL1Quiz('A')}
                      className={`quiz-card w-full ${l1QuizAnswer === 'A' ? 'card-active-success' : ''}`}
                    >
                      <div className="font-bold text-[11.5px] text-slate-900 text-emerald-950 flex items-center gap-1">
                        🎯 Eine mittlere Wahlfranchise (z.B. CHF 1'000 oder CHF 1'500)
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                        Man erhält kaum Prämienrabatt durch die Versicherung, trägt aber die ersten CHF 1500.- im Behandlungsfall trotzdem ganz allein. Das BAG rät dringend von diesen Zwischenstufen ab.
                      </p>
                    </button>
                  </div>

                  {/* Responsive Clean Quiz Feedbacks */}
                  <AnimatePresence mode="wait">
                    {l1Feedback && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3.5 rounded-xl border text-[10px] leading-relaxed font-sans mt-5 flex items-start gap-2 ${l1Feedback.isCorrect ? 'bg-green-50 border-green-200 text-green-950' : 'bg-red-50 border-red-200 text-red-950'}`}
                      >
                        {l1Feedback.isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />}
                        <div>
                          <strong>{l1Feedback.isCorrect ? 'Ausgezeichnet!' : 'Fehler aufgedeckt:'}</strong>
                          <p className="mt-1">{l1Feedback.text}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-8">
                  <button 
                    disabled={l1QuizAnswer === null}
                    onClick={completeLevel1}
                    className={`w-full py-3.5 rounded-xl font-bold font-display text-xs text-center transition tracking-wider active:scale-98 ${l1QuizAnswer !== null 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow cursor-pointer' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {l1QuizAnswer !== null ? 'Level 1 abschliessen & weitergehen 🗺' : 'Bitte wähle eine Option aus 🔒'}
                  </button>
                </div>
              </motion.div>
            )}


            {/* SCREEN: LEVEL 2 DE STEUER-HACK SETUP SCREEN */}
            {currentScreen === 'l2-setup' && (
              <motion.div 
                key="l2-setup"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="flex-1 flex flex-col justify-between p-6 overflow-y-auto custom-scrollbar"
              >
                <div>
                  <div className="bg-slate-900 text-white p-4 -mx-6 -mt-6 mb-5 text-center shadow-sm relative">
                    <button 
                      onClick={() => handleNav('map')} 
                      className="absolute left-4 top-4 text-xs font-bold bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded text-white active:scale-95 transition-all"
                    >
                      ← Pfad
                    </button>
                    <h1 className="text-xs font-black tracking-widest font-display text-white uppercase select-none">Quest 2: Der Steuer-Hack</h1>
                    <p className="text-[9px] text-amber-400 font-mono mt-0.5 uppercase tracking-wider">SÄULE 3A PRIVATE VORSORGE</p>
                  </div>

                  {/* Didaktisches Prinzip: Von Gross nach Klein Box */}
                  <div className="bg-slate-100 border-l-4 border-amber-500 rounded-r-xl p-3.5 mb-5 space-y-2 text-[10.5px]">
                    <div className="font-semibold text-slate-950 uppercase tracking-wider text-[9px] text-amber-600 font-mono">
                      Didaktischer Pfad: Säule 3a Vorsorge
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">🌍 1. Übergeordneter Kontext (Das Grosse):</span>
                      Die Säule 3a ist Teil des Schweizer Drei-Säulen-Systems. Sie dient dazu, Vorsorgelücken der staatlichen 1. Säule (AHV/IV) und der beruflichen 2. Säule (Pensionskasse) im Alter zu schliessen, um deinen gewohnten Lebensstandard abzusichern.
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">🏦 2. Das spezifische Instrument (Das Mittlere):</span>
                      Die gebundene private Selbstvorsorge (Säule 3a) ist ein staatlich gefördertes, steuerlich privilegiertes Instrument zur privaten Altersvorsorge.
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">⚙️ 3. Die Stellschraube (Das Kleine):</span>
                      Deine Stellschraube ist der Einzahlungsbetrag bis zum gesetzlichen Höchstsatz (aktuell CHF 7'258.- pro Jahr). Jeder eingezahlte Franken wird direkt von deinem steuerbaren Einkommen abgezogen.
                    </div>
                  </div>

                  <h2 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="w-4.5 h-4.5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-mono">1</span>
                    Deine jährliche Säule 3a Einzahlung
                  </h2>
                  <p className="text-slate-500 text-[10px] mb-3 leading-relaxed">
                    Wie viel deines fiktiven Einkommens zahlst du dieses Jahr ein? Das Geld ist steuerlich vollständig absetzbar.
                  </p>

                  <div className="space-y-2.5">
                    <button 
                      id="btn-3a-0"
                      onClick={() => { playChimeSound('click'); setGameState(prev => ({ ...prev, selected3a: 0 })); }}
                      className={`poker-grid-card w-full flex items-center gap-3 p-3 text-left transition-all ${gameState.selected3a === 0 ? 'card-active' : ''}`}
                    >
                      <div className="text-sm font-black text-rose-700 bg-rose-50 rounded-lg p-1.5 min-w-[100px] text-center font-mono">
                        CHF 0.–
                      </div>
                      <div className="text-[9px] text-slate-500 flex-1 leading-normal">
                        <strong className="text-slate-800 block mb-0.5 leading-tight text-[10px]">Keine Einzahlung</strong>
                        Ich lasse mein flüssiges Geld auf dem normalen Sparkonto bei Minimalzinsen liegen.
                      </div>
                    </button>

                    <button 
                      id="btn-3a-3505"
                      onClick={() => { playChimeSound('click'); setGameState(prev => ({ ...prev, selected3a: 3600 })); }}
                      className={`poker-grid-card w-full flex items-center gap-3 p-3 text-left transition-all ${gameState.selected3a === 3600 ? 'card-active' : ''}`}
                    >
                      <div className="text-sm font-black text-sky-700 bg-sky-50 rounded-lg p-1.5 min-w-[100px] text-center font-mono animate-pulse">
                        CHF 3'600.–
                      </div>
                      <div className="text-[9px] text-slate-500 flex-1 leading-normal">
                        <strong className="text-slate-800 block mb-0.5 leading-tight text-[10px]">Teilbetrag einzahlen</strong>
                        Ich investiere ungefähr die Hälfte des jährlichen legalen Maximums für Angestellte.
                      </div>
                    </button>

                    <button 
                      id="btn-3a-7258"
                      onClick={() => { playChimeSound('click'); setGameState(prev => ({ ...prev, selected3a: 7258 })); }}
                      className={`poker-grid-card w-full flex items-center gap-3 p-3 text-left transition-all ${gameState.selected3a === 7258 ? 'card-active' : ''}`}
                    >
                      <div className="text-sm font-black text-emerald-800 bg-emerald-50 rounded-lg p-1.5 min-w-[100px] text-center font-mono shadow-sm">
                        CHF 7'258.–
                      </div>
                      <div className="text-[9px] text-slate-500 flex-1 leading-normal">
                        <strong className="text-emerald-950 block mb-0.5 leading-tight text-[10px] font-bold">Maximalbetrag (2025/2026)!</strong>
                        Ich schöpfe das offizielle eidgenössische Maximum für Personen mit Pensionskasse voll aus.
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    onClick={handleL2Simulate}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-3.5 rounded-xl shadow-lg transition active:scale-98 text-xs cursor-pointer"
                  >
                    Steuerersparnis berechnen 🧮
                  </button>
                </div>
              </motion.div>
            )}


            {/* SCREEN: LEVEL 2 RESULTS SCREEN */}
            {currentScreen === 'l2-result' && (
              <motion.div 
                key="l2-result"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="flex-1 flex flex-col justify-between p-6 overflow-y-auto custom-scrollbar"
              >
                <div className="space-y-4">
                  {/* Results box */}
                  <div className="bg-emerald-50 border border-emerald-250 rounded-2xl p-4 text-center shadow-sm">
                    <h3 className="font-bold text-slate-800 text-[10px] tracking-wider uppercase font-mono">Deine persönliche Steuerersparnis</h3>
                    <div className="text-4xl font-black text-emerald-700 my-1 font-mono">
                      CHF {calculatedTaxSavingsL2.toLocaleString('de-CH')}.-
                    </div>
                    <p className="text-[9.5px] text-slate-500 leading-relaxed font-sans">
                      Dieser Sparbetrag wird am Jahresende vollumfänglich von deinem steuerpflichtigen Einkommen abgezogen. Du schenkst dem Staat somit kein fiktives Geld!
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-emerald-200/50 text-[9px] text-slate-500 leading-relaxed font-mono">
                      Gerechnet mit einem fiktiven, pauschalen Grenzsteuersatz von 15% als konservativer Schweizer Durchschnitt.
                      <div className="font-bold text-slate-600 mt-1 uppercase tracking-tight">
                        Hinweis: Deine reale Ersparnis hängt von deinem Wohnkanton und deinem steuerbaren Einkommen ab.
                      </div>
                    </div>
                  </div>

                  {/* Accurate rules laid by Bundesamt für Sozialversicherungen BSV */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-bold text-blue-950 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 mb-1.5">
                      <PiggyBank className="w-4 h-4 text-blue-800" /> Eidgenössische Vorgaben (BSV)
                    </h4>
                    <p className="text-[10px] text-blue-950 leading-relaxed leading-relaxed font-sans">
                      Das Bundesamt für Sozialversicherungen (BSV) regelt die Maximalbeiträge zur Säule 3a jährlich neu:
                    </p>
                    <ul className="list-disc pl-3 mt-1.5 text-[9.5px] text-blue-950 space-y-1.5 font-sans leading-normal">
                      <li>Für Angestellte <strong>mit Pensionskasse</strong> beträgt der Höchstsatz zurzeit <strong>CHF 7'258.-</strong> pro Kalenderjahr.</li>
                      <li>Für Erwerbstätige <strong>ohne Pensionskasse</strong> (oft Selbstständige) gilt: Bis max. 20% des Netto-Erwerbseinkommens, höchstens jedoch <strong>CHF 36'288.-</strong> im Kalenderjahr.</li>
                    </ul>
                    <div className="mt-2 text-[9.5px] text-slate-700 bg-white/70 p-2 rounded border border-blue-100 italic leading-relaxed">
                      💡 <strong>Steuerfreie Renditen:</strong> Zinserträge und Gewinne auf 3a-Vorsorgekonten sind komplett befreit von Vermögens- und Einkommenssteuern bis zur Auszahlung.
                    </div>
                  </div>

                </div>

                <div className="mt-8">
                  <button 
                    onClick={() => handleNav('l2-quiz')}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-3.5 rounded-xl shadow transition text-xs flex items-center justify-center gap-1"
                  >
                    <span>Zur letzten Boss-Frage 🧠</span> <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}


            {/* SCREEN: LEVEL 2 QUIZ SCREEN */}
            {currentScreen === 'l2-quiz' && (
              <motion.div 
                key="l2-quiz"
                initial={{ opacity: 0, x: 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -25 }}
                className="flex-1 flex flex-col justify-between p-6 overflow-y-auto custom-scrollbar"
              >
                <div>
                  <div className="bg-slate-950 text-amber-400 p-4 -mx-6 -mt-6 mb-5 text-center shadow">
                    <span className="text-[8px] uppercase tracking-widest font-mono text-slate-500 block">Letzter Checkpoint</span>
                    <h1 className="text-xs font-black tracking-widest font-display uppercase flex items-center justify-center gap-1.5">
                      🏛️ BOSS-FRAGE: DIE BEZUGSREGELN
                    </h1>
                  </div>

                  <p className="text-slate-600 text-[10.5px] mb-4 leading-relaxed text-center px-1 font-sans">
                    Um das Schweizer Spar-Zertifikat zu erhalten, musst du die Bindungslogik der Säule 3a korrekt benennen.
                  </p>

                  <h3 className="font-bold text-slate-950 text-xs text-center mb-5 leading-normal bg-slate-50 p-3 rounded-xl border border-slate-200">
                    Unter welchen Voraussetzungen darfst du dein angespartes Säule 3a Guthaben gesetzlich vorzeitig beziehen?
                  </h3>

                  <div className="space-y-3">
                    <button 
                      onClick={() => handleAnswerL2Quiz('A')}
                      className={`quiz-card w-full ${l2QuizAnswer === 'A' ? 'card-active' : ''}`}
                    >
                      <div className="font-semibold text-[11px] text-slate-805">
                        ❌ Bei einem kurzfristigen Liquiditätsengpass
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1">
                        Wenn ich dringend Kreditkarten decken oder den alltäglichen privaten Konsum finanzieren will. Dies ist gesetzlich nicht gestattet.
                      </p>
                    </button>

                    <button 
                      onClick={() => handleAnswerL2Quiz('B')}
                      className={`quiz-card w-full ${l2QuizAnswer === 'B' ? 'card-active-success' : ''}`}
                    >
                      <div className="font-bold text-[11.5px] text-slate-900 text-emerald-950 flex items-center gap-1">
                        🎯 Nur für gesetzlich verankerte Zwecke (BSV)
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                        Zur Förderung von selbstbewohntem Wohneigentum (WEG), bei Aufnahme einer selbstständigen Erwerbstätigkeit, oder bei definitiver Auswanderung aus der Schweiz.
                      </p>
                    </button>
                  </div>

                  {/* Output correct/error prompt info */}
                  <AnimatePresence mode="wait">
                    {l2Feedback && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3.5 rounded-xl border text-[10px] leading-relaxed font-sans mt-5 flex items-start gap-2 ${l2Feedback.isCorrect ? 'bg-green-50 border-green-200 text-green-950' : 'bg-red-50 border-red-200 text-red-950'}`}
                      >
                        {l2Feedback.isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />}
                        <div>
                          <strong>{l2Feedback.isCorrect ? 'Exzellent gelöst!' : 'Hinweis:'}</strong>
                          <p className="mt-1">{l2Feedback.text}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-8">
                  <button 
                    disabled={l2QuizAnswer === null}
                    onClick={completeLevel2}
                    className={`w-full py-3.5 rounded-xl font-bold font-display text-xs text-center transition tracking-wider active:scale-98 ${l2QuizAnswer !== null 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow cursor-pointer' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {l2QuizAnswer !== null ? 'Spiel beenden & Zertifikat freischalten 🏆' : 'Bitte wähle eine Option aus 🔒'}
                  </button>
                </div>
              </motion.div>
            )}


            {/* SCREEN: FINAL GAME SATISFACTION LEVEL & CERTIFICATE UNLOCKED */}
            {currentScreen === 'l2-complete' && (
              <motion.div 
                key="l2-complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col justify-between p-6 overflow-y-auto custom-scrollbar bg-slate-900 text-white"
              >
                <div className="space-y-4 text-center">
                  <div className="py-6 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center border-2 border-red-500 mb-3 animate-pulse">
                      <Award className="w-8 h-8 text-amber-400" />
                    </div>
                    <h1 className="text-lg font-black tracking-widest font-display text-white uppercase leading-tight">
                      QUESTS BEENDET!
                    </h1>
                    <p className="text-[10px] text-amber-300 font-mono mt-1 uppercase tracking-wide">Privat-Diplom erlangt</p>
                  </div>

                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left shadow-md">
                    <h3 className="font-bold text-xs text-white mb-2 font-display uppercase tracking-wider flex items-center gap-1.5 justify-center text-center">
                      🎖️ Deine Schweizer Spar-Erfolge:
                    </h3>
                    <ul className="text-[10.5px] text-slate-300 space-y-2 mt-4">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>Krankenkassen-Poker:</strong> Gelernt, warum mittlere Franchisen mathematisch unvorteilhaft sind.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>Der Steuer-Hack:</strong> Profitiert vom Steuerabzug beim Bundesamt für Sozialversicherungen.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>Eidgenössische Gesetzgebung:</strong> Regelungen der BAG & BSV für das Jahr 2026 gemeistert.
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* FORM FEEDBACK REGISTER */}
                  {isSubmitted ? (
                    <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl p-5 mt-2 text-left space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                          Feedback übermittelt! 🇨🇭
                        </h4>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        Vielen Dank für deine wertvolle Rückmeldung und die Stimmabgabe für die nächste Version! Deine Antworten wurden sicher für Timo aufbereitet.
                      </p>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5 font-mono text-[9px] text-slate-400">
                        <span className="font-bold text-slate-200 uppercase tracking-tight block border-b border-slate-800 pb-1 mb-1">Übertragene Daten:</span>
                        <div>• Hilft begreifen: <span className="text-slate-250 font-bold">{helpsUnderstand === 'ja' ? 'Ja 👍' : 'Nein 👎'}</span></div>
                        <div>• Weitere Levels: <span className="text-slate-250 font-bold">{wantsMoreLevels === 'ja' ? 'Ja 👍' : 'Nein 👎'}</span></div>
                        <div>• Empfehlung: <span className="text-slate-250 font-bold">{wouldRecommend === 'ja' ? 'Ja 👍' : 'Nein 👎'}</span></div>
                        <div className="mt-1 pb-1">
                          • Gewählte Themen: 
                          <span className="text-slate-200 block pl-2 mt-0.5 whitespace-pre-line">
                            {votedTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}
                          </span>
                        </div>
                        {userEmail && <div className="border-t border-slate-800 pt-1">• E-Mail: <span className="text-slate-300">{userEmail}</span></div>}
                      </div>
                      <p className="text-[9.5px] text-amber-300 italic text-center font-semibold leading-snug">
                        🔔 Wir benachrichtigen dich gratis, sobald neue Kapitel gelauncht werden!
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 text-left space-y-4">
                      <div className="text-center">
                        <h4 className="font-bold text-xs text-amber-400 mb-1">
                          Gefällt dir die App? Feedback & Umfrage 📝
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Hilf uns, die Schweizer Finanzbildung zu verbessern und nimm an der Abstimmung teil.
                        </p>
                      </div>

                      {/* FEEDBACK SYSTEM - MANDATORY YES/NO QUESTIONS */}
                      <div className="space-y-3 pt-1 border-t border-slate-800/60">
                        {/* Q1 */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-200 leading-snug">
                            1. Die App hilft mir Adulting Themen zu begreifen. <span className="text-red-500">*</span>
                          </p>
                          <div className="flex gap-2">
                            <button 
                              type="button" 
                              onClick={() => { setHelpsUnderstand('ja'); playChimeSound('click'); }}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold border transition duration-200 ${helpsUnderstand === 'ja' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                            >
                              Ja 👍
                            </button>
                            <button 
                              type="button" 
                              onClick={() => { setHelpsUnderstand('nein'); playChimeSound('click'); }}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold border transition duration-200 ${helpsUnderstand === 'nein' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                            >
                              Nein 👎
                            </button>
                          </div>
                        </div>

                        {/* Q2 */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-200 leading-snug">
                            2. Ich wünsche mir weitere Levels. <span className="text-red-500">*</span>
                          </p>
                          <div className="flex gap-2">
                            <button 
                              type="button" 
                              onClick={() => { setWantsMoreLevels('ja'); playChimeSound('click'); }}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold border transition duration-200 ${wantsMoreLevels === 'ja' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                            >
                              Ja 👍
                            </button>
                            <button 
                              type="button" 
                              onClick={() => { setWantsMoreLevels('nein'); playChimeSound('click'); }}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold border transition duration-200 ${wantsMoreLevels === 'nein' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                            >
                              Nein 👎
                            </button>
                          </div>
                        </div>

                        {/* Q3 */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-200 leading-snug">
                            3. Ich würde diese App Freunden empfehlen. <span className="text-red-500">*</span>
                          </p>
                          <div className="flex gap-2">
                            <button 
                              type="button" 
                              onClick={() => { setWouldRecommend('ja'); playChimeSound('click'); }}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold border transition duration-200 ${wouldRecommend === 'ja' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                            >
                              Ja 👍
                            </button>
                            <button 
                              type="button" 
                              onClick={() => { setWouldRecommend('nein'); playChimeSound('click'); }}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-[10.5px] font-bold border transition duration-200 ${wouldRecommend === 'nein' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                            >
                              Nein 👎
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* TOPICS SELECTION (Choose up to 3) */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/60">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] font-bold text-amber-300">
                            Wähle Wunschthemen für Level 3+ (max. 3):
                          </p>
                          <span className="text-[9px] font-mono font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                            {votedTopics.length} / 3
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-tight">
                          Stimme ab, welche 3 Schweizer Themen in der nächsten Spielversion gelauncht werden sollen.
                        </p>
                        
                        <div className="space-y-1.5 mt-1">
                          {AVAILABLE_TOPICS.map((topic) => {
                            const isSelected = votedTopics.includes(topic);
                            const isMaxReached = votedTopics.length >= 3;
                            return (
                              <button
                                key={topic}
                                type="button"
                                onClick={() => {
                                  playChimeSound('click');
                                  if (isSelected) {
                                    setVotedTopics(votedTopics.filter(t => t !== topic));
                                  } else {
                                    if (!isMaxReached) {
                                      setVotedTopics([...votedTopics, topic]);
                                    }
                                  }
                                }}
                                disabled={!isSelected && isMaxReached}
                                className={`w-full text-left p-2 rounded-lg border text-[10px] transition duration-200 flex items-center justify-between gap-2.5 ${
                                  isSelected 
                                    ? 'bg-blue-950/30 border-blue-500/70 text-blue-200' 
                                    : isMaxReached 
                                      ? 'bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span className="font-sans text-[10px]">{topic}</span>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition ${
                                  isSelected ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-600 bg-slate-950'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* EMAIL INPUT */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                        <p className="text-[10px] font-semibold text-slate-200">
                          Deine E-Mail für Beta-Einladungen (optional)
                        </p>
                        <input 
                          type="email"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          placeholder="z.B. user@web.ch"
                          className="w-full bg-slate-900 text-white placeholder-slate-500 border border-slate-800 rounded-lg px-3 py-2 text-[10.5px] focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      {/* ACTIONS BAR */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/60">
                        {helpsUnderstand && wantsMoreLevels && wouldRecommend ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                const bodyText = `Hallo Timo,\n\nHier ist mein Feedback zur Schweizer Adulting App:\n--------------------------------------------------------\n1. Hilft mir beim Begreifen: ${helpsUnderstand === 'ja' ? 'JA' : 'NEIN'}\n2. Wünsche mir weitere Levels: ${wantsMoreLevels === 'ja' ? 'JA' : 'NEIN'}\n3. Empfehle die App an Freunde: ${wouldRecommend === 'ja' ? 'JA' : 'NEIN'}\n\nAusgewählte Top 3 Wunschthemen für die nächste Version:\n${votedTopics.length > 0 ? votedTopics.map((t, idx) => `  - ${t}`).join('\n') : '  - Keine Themen ausgewählt'}\n\nAbsender E-Mail: ${userEmail || 'Keine E-Mail angegeben'}\n--------------------------------------------------------\nGesendet aus der Adulting App.`;
                                window.location.href = `mailto:timo.bueschlen@gmail.com?subject=${encodeURIComponent("Adulting App Feedback & Stimme")}&body=${encodeURIComponent(bodyText)}`;
                                setIsSubmitted(true);
                                playChimeSound('success');
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg active:scale-98 transition flex items-center justify-center gap-1.5 text-xs shadow-md cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" /> Feedback per E-Mail absenden 🚀
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                const bodyText = `Adulting App - Schweizer Finanzspiel Feedback & Abstimmung\n--------------------------------------------------------\n1. Hilft mir beim Begreifen: ${helpsUnderstand === 'ja' ? 'JA' : 'NEIN'}\n2. Wünsche mir weitere Levels: ${wantsMoreLevels === 'ja' ? 'JA' : 'NEIN'}\n3. Empfehle die App an Freunde: ${wouldRecommend === 'ja' ? 'JA' : 'NEIN'}\n\nAusgewählte Top 3 Wunschthemen für die nächste Version:\n${votedTopics.length > 0 ? votedTopics.map((t, idx) => `  - ${t}`).join('\n') : '  - Keine Themen ausgewählt'}\n\nAbsender E-Mail: ${userEmail || 'Keine E-Mail angegeben'}\n--------------------------------------------------------`;
                                navigator.clipboard.writeText(bodyText).then(() => {
                                  setIsCopied(true);
                                  setIsSubmitted(true);
                                  playChimeSound('success');
                                  setTimeout(() => setIsCopied(false), 3000);
                                }).catch(() => {
                                  setIsSubmitted(true);
                                });
                              }}
                              className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold py-2 px-4 rounded-lg active:scale-98 transition flex items-center justify-center gap-1.5 text-[10.5px] cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 text-slate-400" /> {isCopied ? 'In die Zwischenablage kopiert! 📋' : 'In Zwischenablage kopieren & abschliessen 📋'}
                            </button>
                            <p className="text-[8.5px] text-slate-500 text-center leading-normal">
                              Tipp: Falls das E-Mail-Programm nicht automatisch startet, klicke auf "Zwischenablage kopieren" und sende die kopierte Zusammenfassung an timo.bueschlen@gmail.com.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center text-slate-500 text-[10px] flex items-center justify-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>Bitte beantworte die 3 Fragen (*), um dein Feedback abzusenden.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={handleReset}
                    className="text-[10px] text-slate-400 hover:text-slate-205 py-2 hover:underline transition-all cursor-pointer block mx-auto font-mono uppercase tracking-widest mt-4"
                  >
                    🔄 Abenteuer erneut starten
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
