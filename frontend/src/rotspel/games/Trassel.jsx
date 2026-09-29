import TrasselGame from './trassel/TrasselGame.jsx'

// Trassel i Rötspel. Spelet har egna lägen, egna resultatrutor och egna
// topplistor (Dagens Trassel per dag, Tidsjakt), så registret har
// scoreFormat: 'none' och onGameOver anropas aldrig — annars skulle
// GameShell visa en andra resultatpanel under spelet.
export default function Trassel() {
  return <TrasselGame />
}
