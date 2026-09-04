import BlastGame from './blast/BlastGame.jsx'

// Rötblast är byggt som ett fristående spel och kallar sin poäng-callback
// onScore. Registret och GameShell talar onGameOver. Den här filen är hela
// översättningen — så slipper vi röra spelets egna filer.
//
// BlastGame anropar onScore först när ett KLASSISKT parti tar slut; koden
// ligger bakom `if (!level)`. Äventyrsbanorna rapporterar alltså ingenting,
// vilket är precis vad vi vill: banorna har egna stjärnor och sparas lokalt.
export default function Rotblast({ onGameOver }) {
  return <BlastGame onScore={onGameOver} />
}
