import KrossenGame from './krossen/KrossenGame.jsx'

// Krossen i Rötspel. Spelet har egna banor, stjärnor och resultatrutor, så
// registret har scoreFormat: 'none' och onGameOver anropas aldrig — annars
// skulle GameShell visa en andra resultatpanel under spelet.
export default function Krossen({ fullskarmSparrad }) {
  return <KrossenGame fullskarmSparrad={fullskarmSparrad} />
}
