export interface DiagnoseStep {
  question: string
  answers: { text: string; next: string }[]
}

export const diagnoseData: Record<string, DiagnoseStep> = {
  start: {
    question: 'Was hat Ihr Gerät?',
    answers: [
      { text: 'Das Gerät geht nicht an', next: 'q1' },
      { text: 'Gerät startet nicht richtig', next: 'q2' },
      { text: 'Probleme im Betrieb (Neustarts, Touchprobleme, Überhitzung)', next: 'q3' },
      { text: 'Probleme mit Telefoniefunktionen (Mikrofon, Lautsprecher, Hörmuschel)', next: 'q4' },
      { text: 'Probleme mit Kamera', next: 'q5' },
      { text: 'Probleme mit Mobilfunk oder WLAN', next: 'q6' },
      { text: 'Displayglas gebrochen', next: 'q7' },
      { text: 'Displayanzeige fehlerhaft (Streifen, Punkte, Aussetzer)', next: 'q8' },
      { text: 'Akku schwach / entlädt schnell', next: 'q9' },
      { text: 'Anderes / mehrere Probleme', next: 'done_other' },
    ],
  },
  q1: {
    question: 'Was passiert beim Einstecken des Ladekabels?',
    answers: [
      { text: 'Es gibt keine Reaktion', next: 'done_q1a' },
      { text: 'Geräusche, aber Display bleibt schwarz', next: 'done_q1b' },
      { text: 'Lädt nur induktiv, nicht mit Kabel', next: 'done_q1c' },
    ],
  },
  done_q1a: {
    question: 'Wenn das Gerät länger nicht in Gebrauch war, ist vermutlich der Akku tiefentladen. Lassen Sie das Gerät mindestens eine Stunde am Strom. Falls es danach nicht startet, besteht die Möglichkeit eines Defekts an der Ladeelektronik. Dafür ist allerdings eine Diagnose vor Ort nötig.',
    answers: [],
  },
  done_q1b: {
    question: 'Höchstwahrscheinlich ist das LCD oder die Hintergrundbeleuchtung des Displays defekt. Dies erfordert einen Austausch des LCD bzw. der ganzen Displayeinheit (modellabhängig).',
    answers: [],
  },
  done_q1c: {
    question: 'Die Ladebuchse ist entweder defekt oder verschmutzt. Versuchen Sie, diese vorsichtig zu reinigen. Falls das nicht hilft, ist ein Austausch notwendig.',
    answers: [],
  },
  q2: {
    question: 'Wie verhält sich das Gerät beim Start?',
    answers: [
      { text: 'Bleibt beim Herstellerlogo hängen', next: 'done_q2a' },
      { text: 'Bleibt später beim Laden hängen', next: 'done_q2b' },
    ],
  },
  done_q2a: {
    question: 'Hier bestehen mehrere Möglichkeiten: es kann sich um ein Softwareproblem oder einen defekten Speicherchip, in seltenen Fällen um einen defekten Akku handeln. Da ist meistens eine genauere Diagnose erforderlich. Bitte beachten Sie, dass wenn eine Softwarebehandlung erforderlich sein sollte, sämtliche Daten verloren gehen!',
    answers: [],
  },
  done_q2b: {
    question: 'Hier können defekte Systemdateien oder ein Speicherfehler die Ursache sein – das lässt sich nur über eine Diagnose herausfinden. Bitte beachten Sie, dass wenn eine Softwarebehandlung erforderlich sein sollte, sämtliche Daten verloren gehen!',
    answers: [],
  },
  q3: {
    question: 'Welches Problem tritt im Betrieb auf?',
    answers: [
      { text: 'Gerät wird ungewöhnlich heiß', next: 'done_q3a' },
      { text: 'Touchscreen reagiert schlecht', next: 'done_q3b' },
      { text: 'Gerät startet grundlos neu oder schaltet sich ab', next: 'done_q3c' },
    ],
  },
  done_q3a: {
    question: 'Bei großer Hitzeentwicklung liegt häufig ein defekter Akku vor, es kann sich allerdings auch um ein Hardwareproblem handeln. Eine Diagnose in der Werkstatt ist empfehlenswert.',
    answers: [],
  },
  done_q3b: {
    question: 'Wahrscheinlich ist das Touchpanel beschädigt. Ein Displayaustausch behebt meist das Problem, in seltenen Fällen ist auch ein gelockerter Touchflex dafür verantwortlich. Dies muss man jedoch vor Ort überprüfen.',
    answers: [],
  },
  done_q3c: {
    question: 'Bei plötzlichen Neustarts kann ein Defekt am Akku vorliegen, aber auch ein Fehler der Hauptplatine. Eine Diagnose ist ratsam.',
    answers: [],
  },
  q4: {
    question: 'Was funktioniert bei der Telefonie nicht?',
    answers: [
      { text: 'Mein Gesprächspartner hört mich schlecht oder gar nicht', next: 'done_q4a' },
      { text: 'Ich höre meinen Gesprächspartner nicht oder schlecht', next: 'done_q4b' },
      { text: 'Nur Telefonieren per Lautsprecher möglich', next: 'done_q4c' },
    ],
  },
  done_q4a: {
    question: 'Wenn Ihr Gesprächspartner Sie schlecht hört, ist häufig nur das Mikrofon verschmutzt. Versuchen Sie es mit einer weichen Zahnbürste und einer Lösung zu reinigen. Wenn dies keine Besserung bringt oder er Sie gar nicht hört, ist ein Austausch empfehlenswert.',
    answers: [],
  },
  done_q4b: {
    question: 'Wenn Sie Ihren Gesprächspartner schlecht hören, ist häufig nur die Hörmuschel verschmutzt. Versuchen Sie sie mit einer weichen Zahnbürste und einer Lösung zu reinigen. Wenn dies keine Besserung bringt oder Sie gar nicht gehört werden, ist höchstwahrscheinlich ein Austausch empfehlenswert.',
    answers: [],
  },
  done_q4c: {
    question: 'Höchstwahrscheinlich ist die Hörmuschel defekt und sollte ersetzt werden.',
    answers: [],
  },
  q5: {
    question: 'Was stimmt mit der Kamera nicht?',
    answers: [
      { text: 'Auf meinen Bildern sind Flecken oder Streifen', next: 'done_q5a' },
      { text: 'Probleme oder ratternde Geräusche beim Fokussieren', next: 'done_q5b' },
      { text: 'Unscharfe Selfies', next: 'done_q5c' },
    ],
  },
  done_q5a: {
    question: 'Entweder ist die Linse verschmutzt oder das Kameramodul defekt. Bitte reinigen Sie die Linse. Sollte dies keine Besserung ergeben, müssen wir vor Ort prüfen, ob das Kameramodul defekt oder die Linse vielleicht von innen verschmutzt ist – letzteres ist aber nur selten der Fall.',
    answers: [],
  },
  done_q5b: {
    question: 'Wahrscheinlich liegt ein Defekt am Autofokusmotor vor. Um dies zu beheben, muss das Kameramodul ausgetauscht werden.',
    answers: [],
  },
  done_q5c: {
    question: 'Versuchen Sie den Frontkamerabereich mit einem sauberen Tuch zu reinigen. Wenn das nichts hilft, muss die Frontkamera ausgetauscht werden.',
    answers: [],
  },
  q6: {
    question: 'Worin besteht das Verbindungsproblem?',
    answers: [
      { text: 'Kein Mobilfunknetz', next: 'done_q6a' },
      { text: 'SIM-Karte wird nicht erkannt', next: 'done_q6b' },
      { text: 'Kein WLAN-Empfang', next: 'done_q6c' },
    ],
  },
  done_q6a: {
    question: 'Bitte probieren Sie zunächst eine andere SIM-Karte aus, um zu prüfen, ob es an Ihrer SIM-Karte liegt. Wenn dies nichts hilft, kann ein Problem am Antennenmodul, am SIM-Leser oder am Baseband-Chip vorliegen. Eine genauere Diagnose ist hier erforderlich.',
    answers: [],
  },
  done_q6b: {
    question: 'Vermutlich ist der SIM-Leser defekt und muss ausgetauscht werden.',
    answers: [],
  },
  done_q6c: {
    question: 'Wahrscheinlich ist der WLAN-Chip defekt. Hier ist eine genauere Diagnose ratsam.',
    answers: [],
  },
  q7: {
    question: 'Hat Ihr Gerät Panzerglas?',
    answers: [
      { text: 'Ja', next: 'done_q7a' },
      { text: 'Nein', next: 'done_q7b' },
    ],
  },
  done_q7a: {
    question: 'Bitte entfernen Sie vorsichtig das Panzerglas und prüfen Sie, ob das Glas darunter beschädigt ist. Falls ja, ist ein Displaytausch notwendig.',
    answers: [],
  },
  done_q7b: {
    question: 'Vermutlich muss das Displayglas oder die gesamte Displayeinheit ausgetauscht werden – das ist modellabhängig.',
    answers: [],
  },
  q8: {
    question: 'Wie zeigt sich der Anzeigefehler?',
    answers: [
      { text: 'Flackern, Streifen oder Punkte sichtbar', next: 'done_q8a' },
      { text: 'Teilausfall oder statisches „Schneegestöber"', next: 'done_q8b' },
    ],
  },
  done_q8a: {
    question: 'Wahrscheinlich ist das Displaypanel defekt, in sehr seltenen Fällen hat sich nur der LCD-Flex gelockert. Höchstwahrscheinlich ist ein Austausch des Displays erforderlich.',
    answers: [],
  },
  done_q8b: {
    question: 'Wahrscheinlich liegt ein Defekt am Grafikchip vor. Es handelt sich hier um eine sehr spezialisierte Reparatur, die wir in unserer Werkstatt leider nicht durchführen können.',
    answers: [],
  },
  q9: {
    question: 'Was trifft am besten zu?',
    answers: [
      { text: 'Akku entlädt sich schneller als gewöhnlich', next: 'done_q9a' },
      { text: 'Gerät lädt gar nicht', next: 'done_q9b' },
      { text: 'Akku lädt sehr langsam', next: 'done_q9c' },
    ],
  },
  done_q9a: {
    question: 'Wahrscheinlich ist der Akku verschlissen. Ein Akkutausch ist empfehlenswert. Es besteht aber auch die Möglichkeit eines Hardwaredefekts, oder dass zu viele Apps mit Hintergrundaktualisierung installiert sind (Messenger, Navi etc.). Reduzieren Sie die Hintergrundaktivitäten dieser Apps und beobachten Sie, ob sich das Problem bessert. Falls nein, empfehlen wir einen Akkutausch oder eine Diagnose.',
    answers: [],
  },
  done_q9b: {
    question: 'Entweder ist der Akku defekt, oder es liegt ein Problem an der Hardware vor. Genaueres kann man erst sagen, wenn man eine Diagnose durchgeführt hat.',
    answers: [],
  },
  done_q9c: {
    question: 'Versuchen Sie es mit einem anderen Ladekabel, um auszuschließen, dass es daran liegt. Sollte das Gerät kabelunabhängig langsam laden, ist wahrscheinlich der Akku verschlissen. Ein Akkutausch ist empfehlenswert.',
    answers: [],
  },
  done_other: {
    question: 'Bitte beschreiben Sie das Problem ausführlich. Wir empfehlen eine Diagnose vor Ort, um den Fehler präzise festzustellen.',
    answers: [],
  },
}
