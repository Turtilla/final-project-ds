/// <reference types="react-scripts" />

declare module 'react-speech-kit';
declare module 'web-speech-cognitive-services/lib/SpeechServices/TextToSpeech';
declare module 'web-speech-cognitive-services/lib/SpeechServices/SpeechToText';

interface Hypothesis {
    "utterance": string;
    "confidence": number
}

interface MySpeechSynthesisUtterance extends SpeechSynthesisUtterance {
    new(s: string);
}

interface MySpeechRecognition extends SpeechRecognition {
    new(s: string);
}

interface SDSContext {
    asr: SpeechRecognition;
    tts: SpeechSynthesis;
    voice: SpeechSynthesisVoice;
    ttsUtterance: MySpeechSynthesisUtterance;
    recResult: Hypothesis[];
    hapticInput: string;
    nluData: any;
    ttsAgenda: string;
    sessionId: string;
    tdmAll: any;
    tdmUtterance: string;
    tdmPassivity: number;
    tdmActions: any;
    tdmVisualOutputInfo: any;
    tdmExpectedAlternatives: any;
    azureAuthorizationToken: string;
    audioCtx: any;

    username: string;
    title: string;
    day: string;
    time: string;
    partner: string;
    celebrity: string;
    info: string;
    category: string;
    joke: string;
    counter: number;
    uncertain: string;
    intent: string;
    uncertainAnswer: string;

    dayCounter: number;
    timeCounter: number;
    partnerCounter: number;

    // final project old idea
    question1: string;
    corrAnswer1: string;
    incorrAnswerOne1: string;
    incorrAnswerTwo1: string;
    incorrAnswerThree1: string;

    question2: string;
    corrAnswer2: string;
    incorrAnswerOne2: string;
    incorrAnswerTwo2: string;
    incorrAnswerThree2: string;

    question3: string;
    corrAnswer3: string;
    incorrAnswerOne3: string;
    incorrAnswerTwo3: string;
    incorrAnswerThree3: string;

    question4: string;
    corrAnswer4: string;
    incorrAnswerOne4: string;
    incorrAnswerTwo4: string;
    incorrAnswerThree4: string;

    question5: string;
    corrAnswer5: string;
    incorrAnswerOne5: string;
    incorrAnswerTwo5: string;
    incorrAnswerThree5: string;

    question6: string;
    corrAnswer6: string;
    incorrAnswerOne6: string;
    incorrAnswerTwo6: string;
    incorrAnswerThree6: string;

    question7: string;
    corrAnswer7: string;
    incorrAnswerOne7: string;
    incorrAnswerTwo7: string;
    incorrAnswerThree7: string;

    question8: string;
    corrAnswer8: string;
    incorrAnswerOne8: string;
    incorrAnswerTwo8: string;
    incorrAnswerThree8: string;

    question9: string;
    corrAnswer9: string;
    incorrAnswerOne9: string;
    incorrAnswerTwo9: string;
    incorrAnswerThree9: string;

    question10: string;
    corrAnswer10: string;
    incorrAnswerOne10: string;
    incorrAnswerTwo10: string;
    incorrAnswerThree10: string;

    question11: string;
    corrAnswer11: string;
    incorrAnswerOne11: string;
    incorrAnswerTwo11: string;
    incorrAnswerThree11: string;

    question12: string;
    corrAnswer12: string;
    incorrAnswerOne12: string;
    incorrAnswerTwo12: string;
    incorrAnswerThree12: string;

    question13: string;  // the backup question
    corrAnswer13: string;
    incorrAnswerOne13: string;
    incorrAnswerTwo13: string;
    incorrAnswerThree13: string;

    // figure out how to use answers

    safePoint: string;
    currentMoney: string;
    remainingQuestions: number;
    currentQuestion: number;

    fiftyFiftyCounter: number;
    switchCounter: number;
    extraQuestionMoney: string;

    difficulty: string;

    // different approach

    questionsList: string[];
    correctAnswers: string[];
    allAnswersTotal: string[][];
    all5050Answers: string[][];

    questions1: string[];
    questions2: string[];
    questions3: string[];

    questions5050_1: string[];
    questions5050_2: string[];
    questions5050_3: string[];

    finalAnswer: string[];
    correctCongrats: string[];

    chitChat1: string[];
    chitChat2: string[];
    chitChat3: string[];

    moneyStages: string[];

}

type SDSEvent =
    | { type: 'TTS_READY' }
    | { type: 'TTS_ERROR' }
    | { type: 'CLICK' }
    | { type: 'SELECT', value: any }
    | { type: 'SHOW_ALTERNATIVES' }
    | { type: 'STARTSPEECH' }
    | { type: 'RECOGNISED' }
    | { type: 'ASRRESULT', value: Hypothesis[] }
    | { type: 'ENDSPEECH' }
    | { type: 'LISTEN' }
    | { type: 'TIMEOUT' }
    | { type: 'entry' }
    | { type: 'SPEAK', value: string };

