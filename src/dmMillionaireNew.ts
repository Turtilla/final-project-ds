import { MachineConfig, send, Action, assign } from "xstate";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const kbRequest = (text: string) =>
    fetch(new Request(`https://opentdb.com/api.php?amount=15&difficulty=${text}&type=multiple`)).then(data => data.json())

// this solution was adapted from https://javascript.info/task/shuffle and is an implementation of the Fisher-Yates shuffle algorithm in JS 
function scramble(array: any) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array
}

const ans_grammar: { [index: string]: { confirmation?: string, negation?: string, help?: string } } = {

    "Yes.": { confirmation: "Yes" },
    "Yeah.": { confirmation: "Yes" },
    "Of course.": { confirmation: "Yes" },
    "Exactly.": { confirmation: "Yes" },
    "Yeah, exactly.": { confirmation: "Yes" },
    "No.": { negation: "No" },
    "Nope.": { negation: "No" },
    "No way.": { negation: "No" },
    "Not what I said.": { negation: "No" },
    "Help.": { help: "Help" },
    "Help me.": { help: "Help" },
    "I don't know what to do.": { help: "Help" },
    "I don't know what to say.": { help: "Help" }
}

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'idle',
    states: {
        idle: {
            on: {
                CLICK: 'init'
            }
        },
        init: {
            on: {
                TTS_READY: 'askForName',
                CLICK: 'askForName'
            }
        },

        getHelp: {
            initial: 'explain',
            states: {
                explain: {
                    entry: say(`The goal of the game is to answer 12 questions correctly. Answering each question increases your reward. You can choose to walk away with your winnings after answering a question correctly.
                                Answering a question incorrectly means you will only receive money from safety steps: $1000 at question 2 and $50000 at question 7. To help you you have 2 lifelines. The lifelines include
                                fifty-fifty, which will remove two of the incorrect answers and switch the question, which will change the question altogether. 
                                You can answer the questions by saying answer 1 or first answer, answer 2 or second answer, etc. It is important that you include the number so that it is easy for the system to understand.
                                You can ask to use lifelines by saying the name of the lifeline. You can ask for the question to be repeated by saying repeat. Between the questions you can quit the game by saying quit. You can
                                walk away with your winnings by saying walk away. You can inquire about the current question number by asking "how much money do I have?", and you can also ask "how many questions are left?".
                                You can ask for help to hear this message again.
                                Make sure to speak clearly and in phrases that the game can understand.`),
                    on: { ENDSPEECH: '#root.dm.playMillionaire.hist' },
                }
            }
        },

        askForName: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: '#root.dm.init',
                        cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                    },
                    {
                        target: 'greet',
                        actions: assign({ username: (context) => context.recResult[0].utterance })
                    },
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Welcome to Who Wants to be a Millionaire! Let's meet our first contestant. Please tell us, what's your name?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                }
            }
        },

        greet: {
            entry: send((context) => ({
                type: 'SPEAK',
                value: `Welcome, nice to meet you, ${context.username}.`
            })),
            on: { ENDSPEECH: 'smallTalkHome' }
        },

        smallTalkHome: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'explaining',
                        cond: (context) => context.recResult[0].utterance.indexOf("skip") !== -1 || context.recResult[0].utterance.indexOf("Skip") !== -1,
                    },
                    {
                        target: '#root.dm.init',
                        cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                    },
                    {
                        target: 'smallTalkJob',
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Where are you from?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                }
            }
        },

        smallTalkJob: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'explaining',
                        cond: (context) => context.recResult[0].utterance.indexOf("skip") !== -1 || context.recResult[0].utterance.indexOf("Skip") !== -1,
                    },
                    {
                        target: '#root.dm.init',
                        cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                    },
                    {
                        target: 'approveOf',
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Sounds awesome! Tell us what you do for a living."),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                }
            }
        },

        approveOf: {
            entry: send((context) => ({
                type: 'SPEAK',
                value: `That sounds really exciting! But enough talk, let's move on.`
            })),
            on: { ENDSPEECH: 'explaining' }
        },

        explaining: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'explainRules',
                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}),
                    },
                    {
                        target: 'selectDifficulty',
                        cond: (context) => "negation" in (ans_grammar[context.recResult[0].utterance] || {}),
                    },
                    {
                        target: '#root.dm.init',
                        cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                    },
                    {
                        target: '.nomatch',
                    }
                ],
                TIMEOUT: { target: '.prompt' }
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Would you like me to explain the rules for you?`
                    })),
                    on: {
                        ENDSPEECH: 'ask'
                    }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I did not get that."),
                    on: { ENDSPEECH: 'prompt' }
                },
            },
        },

        explainRules: {
            entry: say(`The goal of the game is to answer 12 questions correctly. Answering each question increases your reward. You can choose to walk away with your winnings after answering a question correctly.
                                Answering a question incorrectly means you will only receive money from safety steps: $1000 at question 2 and $50000 at question 7. To help you you have 2 lifelines. The lifelines include
                                fifty-fifty, which will remove two of the incorrect answers and switch the question, which will change the question altogether. You can fifty-fifty a switched question, but you cannot switch a
                                question you used fifty-fifty on.
                                You can answer the questions by saying answer 1 or first answer, answer 2 or second answer, etc. It is important that you include the number so that it is easy for the system to understand.
                                You can ask to use lifelines by saying the name of the lifeline. You can ask for the question to be repeated by saying repeat. Between the questions you can quit the game by saying quit. You can
                                walk away with your winnings by saying walk away. You can inquire about the current question number by asking "how much money do I have?", and you can also ask "how many questions are left?".
                                Make sure to speak clearly and in phrases that the game can understand.`),
            on: { ENDSPEECH: 'selectDifficulty' }
        },

        selectDifficulty: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'fetchQuestions',
                        cond: (context) => context.recResult[0].utterance.indexOf("easy") !== -1 || context.recResult[0].utterance.indexOf("Easy") !== -1,
                        actions: assign({ difficulty: (context) => 'easy' })
                    },
                    {
                        target: 'fetchQuestions',
                        cond: (context) => context.recResult[0].utterance.indexOf("medium") !== -1 || context.recResult[0].utterance.indexOf("Medium") !== -1,
                        actions: assign({ difficulty: (context) => 'medium' })
                    },
                    {
                        target: 'fetchQuestions',
                        cond: (context) => context.recResult[0].utterance.indexOf("hard") !== -1 || context.recResult[0].utterance.indexOf("Hard") !== -1,
                        actions: assign({ difficulty: (context) => 'hard' })
                    },
                    {
                        target: '#root.dm.init',
                        cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `What difficulty would you like to play on, ${context.username}?`
                    })),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I did not get what you said. Could you repeat?"),
                    on: { ENDSPEECH: 'ask' } 
                },
            }
        },

        fetchQuestions: {
            invoke: {
                id: 'getInfo',
                src: (context, event) => kbRequest(context.difficulty), 
                onDone: {
                    target: 'playMillionaire',
                    actions: [
                        assign({ safePoint: (context) => '$0' }),
                        assign({ currentMoney: (context) => '$0' }),
                        assign({ remainingQuestions: (context) => 12 }),
                        assign({ currentQuestion: (context) => 0 }),
                        assign({ counter: (context) => 0 }),
                        assign({ fiftyFiftyCounter: (context) => 0 }),
                        assign({ switchCounter: (context) => 0 }),

                        assign({
                            questionsList: (context, event) => [
                                event.data.results[0].question, event.data.results[1].question, event.data.results[2].question, event.data.results[3].question, event.data.results[4].question, event.data.results[5].question,
                                event.data.results[6].question, event.data.results[7].question, event.data.results[8].question, event.data.results[9].question, event.data.results[10].question, event.data.results[11].question,
                                event.data.results[12].question
                            ]
                        }),
                        assign({
                            correctAnswers: (context, event) => [
                                event.data.results[0].correct_answer, event.data.results[1].correct_answer, event.data.results[2].correct_answer, event.data.results[3].correct_answer, event.data.results[4].correct_answer,
                                event.data.results[5].correct_answer, event.data.results[6].correct_answer, event.data.results[7].correct_answer, event.data.results[8].correct_answer, event.data.results[9].correct_answer,
                                event.data.results[10].correct_answer, event.data.results[11].correct_answer, event.data.results[12].correct_answer
                            ]
                        }),
                        assign({
                            allAnswersTotal: (context, event) => [
                                scramble([event.data.results[0].correct_answer, event.data.results[0].incorrect_answers[0], event.data.results[0].incorrect_answers[1], event.data.results[0].incorrect_answers[2]]),
                                scramble([event.data.results[1].correct_answer, event.data.results[1].incorrect_answers[0], event.data.results[1].incorrect_answers[1], event.data.results[1].incorrect_answers[2]]),
                                scramble([event.data.results[2].correct_answer, event.data.results[2].incorrect_answers[0], event.data.results[2].incorrect_answers[1], event.data.results[2].incorrect_answers[2]]),
                                scramble([event.data.results[3].correct_answer, event.data.results[3].incorrect_answers[0], event.data.results[3].incorrect_answers[1], event.data.results[3].incorrect_answers[2]]),
                                scramble([event.data.results[4].correct_answer, event.data.results[4].incorrect_answers[0], event.data.results[4].incorrect_answers[1], event.data.results[4].incorrect_answers[2]]),
                                scramble([event.data.results[5].correct_answer, event.data.results[5].incorrect_answers[0], event.data.results[5].incorrect_answers[1], event.data.results[5].incorrect_answers[2]]),
                                scramble([event.data.results[6].correct_answer, event.data.results[6].incorrect_answers[0], event.data.results[6].incorrect_answers[1], event.data.results[6].incorrect_answers[2]]),
                                scramble([event.data.results[7].correct_answer, event.data.results[7].incorrect_answers[0], event.data.results[7].incorrect_answers[1], event.data.results[7].incorrect_answers[2]]),
                                scramble([event.data.results[8].correct_answer, event.data.results[8].incorrect_answers[0], event.data.results[8].incorrect_answers[1], event.data.results[8].incorrect_answers[2]]),
                                scramble([event.data.results[9].correct_answer, event.data.results[9].incorrect_answers[0], event.data.results[9].incorrect_answers[1], event.data.results[9].incorrect_answers[2]]),
                                scramble([event.data.results[10].correct_answer, event.data.results[10].incorrect_answers[0], event.data.results[10].incorrect_answers[1], event.data.results[10].incorrect_answers[2]]),
                                scramble([event.data.results[11].correct_answer, event.data.results[11].incorrect_answers[0], event.data.results[11].incorrect_answers[1], event.data.results[11].incorrect_answers[2]]),
                                scramble([event.data.results[12].correct_answer, event.data.results[12].incorrect_answers[0], event.data.results[12].incorrect_answers[1], event.data.results[12].incorrect_answers[2]]),
                            ]
                        }),
                        assign({
                            all5050Answers: (context, event) => [
                                scramble([event.data.results[0].correct_answer, event.data.results[0].incorrect_answers[0]]),
                                scramble([event.data.results[1].correct_answer, event.data.results[1].incorrect_answers[0]]),
                                scramble([event.data.results[2].correct_answer, event.data.results[2].incorrect_answers[0]]),
                                scramble([event.data.results[3].correct_answer, event.data.results[3].incorrect_answers[0]]),
                                scramble([event.data.results[4].correct_answer, event.data.results[4].incorrect_answers[0]]),
                                scramble([event.data.results[5].correct_answer, event.data.results[5].incorrect_answers[0]]),
                                scramble([event.data.results[6].correct_answer, event.data.results[6].incorrect_answers[0]]),
                                scramble([event.data.results[7].correct_answer, event.data.results[7].incorrect_answers[0]]),
                                scramble([event.data.results[8].correct_answer, event.data.results[8].incorrect_answers[0]]),
                                scramble([event.data.results[9].correct_answer, event.data.results[9].incorrect_answers[0]]),
                                scramble([event.data.results[10].correct_answer, event.data.results[10].incorrect_answers[0]]),
                                scramble([event.data.results[11].correct_answer, event.data.results[11].incorrect_answers[0]]),
                                scramble([event.data.results[12].correct_answer, event.data.results[12].incorrect_answers[0]]),
                            ]
                        }),

                        assign({
                            questions1: (context, event) => [
                                `Okay, your first question is: ${context.questionsList[0]} The possible answers are: 1, ${context.allAnswersTotal[0][0]}, 2, ${context.allAnswersTotal[0][1]}, 3, ${context.allAnswersTotal[0][2]}, 4, ${context.allAnswersTotal[0][3]}.`,  //1st
                                `Now, the second question is: ${context.questionsList[1]} The answers are: 1, ${context.allAnswersTotal[1][0]}, 2, ${context.allAnswersTotal[1][1]}, 3, ${context.allAnswersTotal[1][2]}, 4, ${context.allAnswersTotal[1][3]}.`,  //2nd
                                `For the next question: ${context.questionsList[2]} The possible answers are: 1, ${context.allAnswersTotal[2][0]}, 2, ${context.allAnswersTotal[2][1]}, 3, ${context.allAnswersTotal[2][2]}, 4, ${context.allAnswersTotal[2][3]}.`,  //3rd
                                `Your next question is the following: ${context.questionsList[3]} You can choose from these answers: 1, ${context.allAnswersTotal[3][0]}, 2, ${context.allAnswersTotal[3][1]}, 3, ${context.allAnswersTotal[3][2]}, 4, ${context.allAnswersTotal[3][3]}.`,  //4th
                                `Your fifth question is: ${context.questionsList[4]} You have the following possible answers: 1, ${context.allAnswersTotal[4][0]}, 2, ${context.allAnswersTotal[4][1]}, 3, ${context.allAnswersTotal[4][2]}, 4, ${context.allAnswersTotal[4][3]}.`,  //5th
                                `Now, the next question is: ${context.questionsList[5]} The answers are: 1, ${context.allAnswersTotal[5][0]}, 2, ${context.allAnswersTotal[5][1]}, 3, ${context.allAnswersTotal[5][2]}, 4, ${context.allAnswersTotal[5][3]}.`,  //6th
                                `This is what we have for the next question: ${context.questionsList[6]} You can answer: 1, ${context.allAnswersTotal[6][0]}, 2, ${context.allAnswersTotal[6][1]}, 3, ${context.allAnswersTotal[6][2]}, 4, ${context.allAnswersTotal[6][3]}.`,  //7th
                                `The eight question is: ${context.questionsList[7]} The possible answers are: 1, ${context.allAnswersTotal[7][0]}, 2, ${context.allAnswersTotal[7][1]}, 3, ${context.allAnswersTotal[7][2]}, 4, ${context.allAnswersTotal[7][3]}.`,  //8th
                                `You're going strong! Up next: ${context.questionsList[8]} Choose from the following answers: 1, ${context.allAnswersTotal[8][0]}, 2, ${context.allAnswersTotal[8][1]}, 3, ${context.allAnswersTotal[8][2]}, 4, ${context.allAnswersTotal[8][3]}.`,  //9th
                                `Okay, your tenth question is: ${context.questionsList[9]} The answers are: 1, ${context.allAnswersTotal[9][0]}, 2, ${context.allAnswersTotal[9][1]}, 3, ${context.allAnswersTotal[9][2]}, 4, ${context.allAnswersTotal[9][3]}.`,  //10th
                                `Now, your penultimate question is: ${context.questionsList[10]} You have the following possible answers: 1, ${context.allAnswersTotal[10][0]}, 2, ${context.allAnswersTotal[10][1]}, 3, ${context.allAnswersTotal[10][2]}, 4, ${context.allAnswersTotal[10][3]}.`,  //11th
                                `Your final question is: ${context.questionsList[11]} Choose from the following: 1, ${context.allAnswersTotal[11][0]}, 2, ${context.allAnswersTotal[11][1]}, 3, ${context.allAnswersTotal[11][2]}, 4, ${context.allAnswersTotal[11][3]}.`,  //12th
                                `Your backup question is: ${context.questionsList[12]} The answers are: 1, ${context.allAnswersTotal[12][0]}, 2, ${context.allAnswersTotal[12][1]}, 3, ${context.allAnswersTotal[12][2]}, 4, ${context.allAnswersTotal[12][3]}.`,  //13th
                            ]
                        }),
                        assign({
                            questions2: (context, event) => [
                                `Let me repeat: ${context.questionsList[0]} The answers are: 1, ${context.allAnswersTotal[0][0]}, 2, ${context.allAnswersTotal[0][1]}, 3, ${context.allAnswersTotal[0][2]}, 4, ${context.allAnswersTotal[0][3]}.`,  //1st
                                `Let me repeat your question: ${context.questionsList[1]} You have the following possible answers: 1, ${context.allAnswersTotal[1][0]}, 2, ${context.allAnswersTotal[1][1]}, 3, ${context.allAnswersTotal[1][2]}, 4, ${context.allAnswersTotal[1][3]}.`,  //2nd
                                `I will say it again: ${context.questionsList[2]} Choose from the following answers: 1, ${context.allAnswersTotal[2][0]}, 2, ${context.allAnswersTotal[2][1]}, 3, ${context.allAnswersTotal[2][2]}, 4, ${context.allAnswersTotal[2][3]}.`,  //3rd
                                `Let me repeat:  ${context.questionsList[3]} The possible answers are: 1, ${context.allAnswersTotal[3][0]}, 2, ${context.allAnswersTotal[3][1]}, 3, ${context.allAnswersTotal[3][2]}, 4, ${context.allAnswersTotal[3][3]}.`,  //4th
                                `I will say it again: ${context.questionsList[4]} The answers are: 1, ${context.allAnswersTotal[4][0]}, 2, ${context.allAnswersTotal[4][1]}, 3, ${context.allAnswersTotal[4][2]}, 4, ${context.allAnswersTotal[4][3]}.`,  //5th
                                `Let me repeat your question: ${context.questionsList[5]} Choose from the following answers: 1, ${context.allAnswersTotal[5][0]}, 2, ${context.allAnswersTotal[5][1]}, 3, ${context.allAnswersTotal[5][2]}, 4, ${context.allAnswersTotal[5][3]}.`,  //6th
                                `I will say it again: ${context.questionsList[6]} The possible answers are: 1, ${context.allAnswersTotal[6][0]}, 2, ${context.allAnswersTotal[6][1]}, 3, ${context.allAnswersTotal[6][2]}, 4, ${context.allAnswersTotal[6][3]}.`,  //7th
                                `I will read again: ${context.questionsList[7]} The answers are: 1, ${context.allAnswersTotal[7][0]}, 2, ${context.allAnswersTotal[7][1]}, 3, ${context.allAnswersTotal[7][2]}, 4, ${context.allAnswersTotal[7][3]}.`,  //8th
                                `I will say it again: ${context.questionsList[8]} The possible answers are: 1, ${context.allAnswersTotal[8][0]}, 2, ${context.allAnswersTotal[8][1]}, 3, ${context.allAnswersTotal[8][2]}, 4, ${context.allAnswersTotal[8][3]}.`,  //9th
                                `Let me repeat:  ${context.questionsList[9]} Choose from the following answers: 1, ${context.allAnswersTotal[9][0]}, 2, ${context.allAnswersTotal[9][1]}, 3, ${context.allAnswersTotal[9][2]}, 4, ${context.allAnswersTotal[9][3]}.`,  //10th
                                `I will read it again: ${context.questionsList[10]} The answers are: 1, ${context.allAnswersTotal[10][0]}, 2, ${context.allAnswersTotal[10][1]}, 3, ${context.allAnswersTotal[10][2]}, 4, ${context.allAnswersTotal[10][3]}.`,  //11th
                                `Let me repeat your final question:  ${context.questionsList[11]} You have the following possible answers: 1, ${context.allAnswersTotal[11][0]}, 2, ${context.allAnswersTotal[11][1]}, 3, ${context.allAnswersTotal[11][2]}, 4, ${context.allAnswersTotal[11][3]}.`,  //12th
                                `Let me repeat your backup question:  ${context.questionsList[12]} The possible answers are: 1, ${context.allAnswersTotal[12][0]}, 2, ${context.allAnswersTotal[12][1]}, 3, ${context.allAnswersTotal[12][2]}, 4, ${context.allAnswersTotal[12][3]}.`,  //13th
                            ]
                        }),
                        assign({
                            questions3: (context, event) => [
                                `I will say it one last time: ${context.questionsList[0]} The possible answers are: 1, ${context.allAnswersTotal[0][0]}, 2, ${context.allAnswersTotal[0][1]}, 3, ${context.allAnswersTotal[0][2]}, 4, ${context.allAnswersTotal[0][3]}.`,  //1st
                                `I will repeat it one last time: ${context.questionsList[1]} The answers are: 1, ${context.allAnswersTotal[1][0]}, 2, ${context.allAnswersTotal[1][1]}, 3, ${context.allAnswersTotal[1][2]}, 4, ${context.allAnswersTotal[1][3]}.`,  //2nd
                                `I will say it one last time: ${context.questionsList[2]} Choose from the following answers: 1, ${context.allAnswersTotal[2][0]}, 2, ${context.allAnswersTotal[2][1]}, 3, ${context.allAnswersTotal[2][2]}, 4, ${context.allAnswersTotal[2][3]}.`,  //3rd
                                `For the last time: ${context.questionsList[3]} The possible answers are: 1, ${context.allAnswersTotal[3][0]}, 2, ${context.allAnswersTotal[3][1]}, 3, ${context.allAnswersTotal[3][2]}, 4, ${context.allAnswersTotal[3][3]}.`,  //4th
                                `I will read it one last time: ${context.questionsList[4]} You can choose from these answers: 1, ${context.allAnswersTotal[4][0]}, 2, ${context.allAnswersTotal[4][1]}, 3, ${context.allAnswersTotal[4][2]}, 4, ${context.allAnswersTotal[4][3]}.`,  //5th
                                `I will repeat the question one last time: ${context.questionsList[5]} The possible answers are: 1, ${context.allAnswersTotal[5][0]}, 2, ${context.allAnswersTotal[5][1]}, 3, ${context.allAnswersTotal[5][2]}, 4, ${context.allAnswersTotal[5][3]}.`,  //6th
                                `I will say it one last time: ${context.questionsList[6]} The answers are: 1, ${context.allAnswersTotal[6][0]}, 2, ${context.allAnswersTotal[6][1]}, 3, ${context.allAnswersTotal[6][2]}, 4, ${context.allAnswersTotal[6][3]}.`,  //7th
                                `I will read it one last time: ${context.questionsList[7]} Choose from the following answers: 1, ${context.allAnswersTotal[7][0]}, 2, ${context.allAnswersTotal[7][1]}, 3, ${context.allAnswersTotal[7][2]}, 4, ${context.allAnswersTotal[7][3]}.`,  //8th
                                `I will say the question one last time: ${context.questionsList[8]} The possible answers are: 1, ${context.allAnswersTotal[8][0]}, 2, ${context.allAnswersTotal[8][1]}, 3, ${context.allAnswersTotal[8][2]}, 4, ${context.allAnswersTotal[8][3]}.`,  //9th
                                `I will repeat it one last time: ${context.questionsList[9]} Choose from the following answers: 1, ${context.allAnswersTotal[9][0]}, 2, ${context.allAnswersTotal[9][1]}, 3, ${context.allAnswersTotal[9][2]}, 4, ${context.allAnswersTotal[9][3]}.`,  //10th
                                `For the last time: ${context.questionsList[10]} The answers are: 1, ${context.allAnswersTotal[10][0]}, 2, ${context.allAnswersTotal[10][1]}, 3, ${context.allAnswersTotal[10][2]}, 4, ${context.allAnswersTotal[10][3]}.`,  //11th
                                `I will read it one last time: ${context.questionsList[11]} You can choose from these answers: 1, ${context.allAnswersTotal[11][0]}, 2, ${context.allAnswersTotal[11][1]}, 3, ${context.allAnswersTotal[11][2]}, 4, ${context.allAnswersTotal[11][3]}.`,  //12th
                                `I will say your backup question one last time: ${context.questionsList[12]} The possible answers are: 1, ${context.allAnswersTotal[12][0]}, 2, ${context.allAnswersTotal[12][1]}, 3, ${context.allAnswersTotal[12][2]}, 4, ${context.allAnswersTotal[12][3]}.`,  //13th
                            ]
                        }),

                        assign({
                            questions5050_1: (context, event) => [
                                `After removing two incorrect answers the question is: ${context.questionsList[0]} The possible answers are: 1, ${context.all5050Answers[0][0]}, 2, ${context.all5050Answers[0][1]}.`,  //1st
                                `After removing two incorrect answers the question is: ${context.questionsList[1]} The answers are: 1, ${context.all5050Answers[1][0]}, 2, ${context.all5050Answers[1][1]}.`,  //2nd
                                `After removing two incorrect answers the question is: ${context.questionsList[2]} Choose from the following answers: 1, ${context.all5050Answers[2][0]}, 2, ${context.all5050Answers[2][1]}.`,  //3rd
                                `After removing two incorrect answers the question is: ${context.questionsList[3]} The possible answers are: 1, ${context.all5050Answers[3][0]}, 2, ${context.all5050Answers[3][1]}.`,  //4th
                                `After removing two incorrect answers the question is: ${context.questionsList[4]} You can choose from these answers: 1, ${context.all5050Answers[4][0]}, 2, ${context.all5050Answers[4][1]}.`,  //5th
                                `After removing two incorrect answers the question is: ${context.questionsList[5]} The possible answers are: 1, ${context.all5050Answers[5][0]}, 2, ${context.all5050Answers[5][1]}.`,  //6th
                                `After removing two incorrect answers the question is: ${context.questionsList[6]} The answers are: 1, ${context.all5050Answers[6][0]}, 2, ${context.all5050Answers[6][1]}.`,  //7th
                                `After removing two incorrect answers the question is: ${context.questionsList[7]} Choose from the following answers: 1, ${context.all5050Answers[7][0]}, 2, ${context.all5050Answers[7][1]}.`,  //8th
                                `After removing two incorrect answers the question is: ${context.questionsList[8]} The possible answers are: 1, ${context.all5050Answers[8][0]}, 2, ${context.all5050Answers[8][1]}.`,  //9th
                                `After removing two incorrect answers the question is: ${context.questionsList[9]} Choose from the following answers: 1, ${context.all5050Answers[9][0]}, 2, ${context.all5050Answers[9][1]}.`,  //10th
                                `After removing two incorrect answers the question is: ${context.questionsList[10]} The answers are: 1, ${context.all5050Answers[10][0]}, 2, ${context.all5050Answers[10][1]}.`,  //11th
                                `After removing two incorrect answers the question is: ${context.questionsList[11]} You can choose from these answers: 1, ${context.all5050Answers[11][0]}, 2, ${context.all5050Answers[11][1]}.`,  //12th
                                `After removing two incorrect answers your backup question is: ${context.questionsList[12]} The possible answers are: 1, ${context.all5050Answers[12][0]}, 2, ${context.all5050Answers[12][1]}.`,  //13th
                            ]
                        }),
                        assign({
                            questions5050_2: (context, event) => [
                                `Let me reiterate it: ${context.questionsList[0]} The possible answers are: 1, ${context.all5050Answers[0][0]}, 2, ${context.all5050Answers[0][1]}.`,  //1st
                                `I will say it one more time: ${context.questionsList[1]} The answers are: 1, ${context.all5050Answers[1][0]}, 2, ${context.all5050Answers[1][1]}.`,  //2nd
                                `I will repeat once more: ${context.questionsList[2]} Choose from the following answers: 1, ${context.all5050Answers[2][0]}, 2, ${context.all5050Answers[2][1]}.`,  //3rd
                                `I will say it one more time: ${context.questionsList[3]} The possible answers are: 1, ${context.all5050Answers[3][0]}, 2, ${context.all5050Answers[3][1]}.`,  //4th
                                `Once again: ${context.questionsList[4]} You can choose from these answers: 1, ${context.all5050Answers[4][0]}, 2, ${context.all5050Answers[4][1]}.`,  //5th
                                `Let me reiterate it:: ${context.questionsList[5]} The possible answers are: 1, ${context.all5050Answers[5][0]}, 2, ${context.all5050Answers[5][1]}.`,  //6th
                                `Let me repeat the question: ${context.questionsList[6]} The answers are: 1, ${context.all5050Answers[6][0]}, 2, ${context.all5050Answers[6][1]}.`,  //7th
                                `Let me reiterate it: ${context.questionsList[7]} Choose from the following answers: 1, ${context.all5050Answers[7][0]}, 2, ${context.all5050Answers[7][1]}.`,  //8th
                                `I will say it one more time ${context.questionsList[8]} The possible answers are: 1, ${context.all5050Answers[8][0]}, 2, ${context.all5050Answers[8][1]}.`,  //9th
                                `I will say the question one more time: ${context.questionsList[9]} Choose from the following answers: 1, ${context.all5050Answers[9][0]}, 2, ${context.all5050Answers[9][1]}.`,  //10th
                                `I will repeat it once again: ${context.questionsList[10]} The answers are: 1, ${context.all5050Answers[10][0]}, 2, ${context.all5050Answers[10][1]}.`,  //11th
                                `I will read it out once more: ${context.questionsList[11]} You can choose from these answers: 1, ${context.all5050Answers[11][0]}, 2, ${context.all5050Answers[11][1]}.`,  //12th
                                `I will say your backup question again: ${context.questionsList[12]} The possible answers are: 1, ${context.all5050Answers[12][0]}, 2, ${context.all5050Answers[12][1]}.`,  //13th
                            ]
                        }),
                        assign({
                            questions5050_3: (context, event) => [
                                `I will read it one last time: ${context.questionsList[0]} The possible answers are: 1, ${context.all5050Answers[0][0]}, 2, ${context.all5050Answers[0][1]}.`,  //1st
                                `I will say it one last time: ${context.questionsList[1]} The answers are: 1, ${context.all5050Answers[1][0]}, 2, ${context.all5050Answers[1][1]}.`,  //2nd
                                `I will repeat it one last time: ${context.questionsList[2]} Choose from the following answers: 1, ${context.all5050Answers[2][0]}, 2, ${context.all5050Answers[2][1]}.`,  //3rd
                                `I will say it one last time: ${context.questionsList[3]} The possible answers are: 1, ${context.all5050Answers[3][0]}, 2, ${context.all5050Answers[3][1]}.`,  //4th
                                `For the last time: ${context.questionsList[4]} You can choose from these answers: 1, ${context.all5050Answers[4][0]}, 2, ${context.all5050Answers[4][1]}.`,  //5th
                                `I will read it one last time: ${context.questionsList[5]} The possible answers are: 1, ${context.all5050Answers[5][0]}, 2, ${context.all5050Answers[5][1]}.`,  //6th
                                `I will repeat the question one last time: ${context.questionsList[6]} The answers are: 1, ${context.all5050Answers[6][0]}, 2, ${context.all5050Answers[6][1]}.`,  //7th
                                `I will say it one last time: ${context.questionsList[7]} Choose from the following answers: 1, ${context.all5050Answers[7][0]}, 2, ${context.all5050Answers[7][1]}.`,  //8th
                                `I will read it one last time: ${context.questionsList[8]} The possible answers are: 1, ${context.all5050Answers[8][0]}, 2, ${context.all5050Answers[8][1]}.`,  //9th
                                `I will say the question one last time: ${context.questionsList[9]} Choose from the following answers: 1, ${context.all5050Answers[9][0]}, 2, ${context.all5050Answers[9][1]}.`,  //10th
                                `I will repeat it one last time: ${context.questionsList[10]} The answers are: 1, ${context.all5050Answers[10][0]}, 2, ${context.all5050Answers[10][1]}.`,  //11th
                                `I will read it one last time: ${context.questionsList[11]} You can choose from these answers: 1, ${context.all5050Answers[11][0]}, 2, ${context.all5050Answers[11][1]}.`,  //12th
                                `I will say your backup question one last time: ${context.questionsList[12]} The possible answers are: 1, ${context.all5050Answers[12][0]}, 2, ${context.all5050Answers[12][1]}.`,  //13th
                            ]
                        }),

                        assign({
                            finalAnswer: (context, event) => [
                                `Is that your final answer?`,  //1st
                                `Are you sure it's that, ${context.username}?`,  //2nd
                                `Are you sure that is the correct answer?`,  //3rd
                                `Is that your final answer?`,  //4th
                                `Are you 100% sure about that, ${context.username}?`,  //5th
                                `So is that your final answer?`,  //6th
                                `Is that your final answer?`,  //7th
                                `${context.username}, are you sure it's that?`,  //8th
                                `Are you sure that is the correct answer?`,  //9th
                                `Is that your final answer?`,  //10th
                                `Are you 100% sure about that?`,  //11th
                                `So is that your final answer?`,  //12th
                                `Is that your final answer?`,  //13th
                            ]
                        }),

                        assign({
                            chitChat1: (context, event) => [
                                `Okay, are you ready to continue, ${context.username}?`,  //1st
                                `Okay, do you want to continue?`,  //2nd
                                `Ready to continue?`,  //3rd
                                `Okay, are you ready to continue?`,  //4th
                                `Okay, do you want to continue?`,  //5th
                                `Ready to continue, ${context.username}??`,  //6th
                                `Shall we continue?`,  //7th
                                `Okay, do you want to continue?`,  //8th
                                `Are you ready to continue?`,  //9th
                                `Up for the next question?`,  //10th
                                `${context.username}?, shall we continue?`,  //11th
                                `Are you ready to continue?`,  //12th
                                `Ready to continue?`,  //13th
                            ]
                        }),
                        assign({
                            chitChat2: (context, event) => [
                                `Are you ready for the next question?`,  //1st
                                `Are you ready to move on to the next question?`,  //2nd
                                `Shall we continue to the next question, ${context.username}?`,  //3rd
                                `Are you ready for the next question?`,  //4th
                                `Are you ready to move on?`,  //5th
                                `Are you ready?`,  //6th
                                `Are you ready to continue?`,  //7th
                                `Are you ready for the next question?`,  //8th
                                `${context.username}, are you ready to move on?`,  //9th
                                `Are you ready to continue to the next question?`,  //10th
                                `Shall we move on to the next question?`,  //11th
                                `Are you ready to move on to the next question?`,  //12th
                                `Are you ready to move on?`,  //13th
                            ]
                        }),
                        assign({
                            chitChat3: (context, event) => [
                                `Are you ready to move on to the next question?`,  //1st
                                `Shall we continue to the next question, ${context.username}?`,  //2nd
                                `Are you ready for the next question?`,  //3rd
                                `Are you ready to move on?`,  //4th
                                `Are you ready, ${context.username}?`,  //5th
                                `Are you ready to continue?`,  //6th
                                `Are you ready for the next question?`,  //7th
                                `Are you ready to move on?`,  //8th
                                `${context.username}, are you ready to continue to the next question?`,  //9th
                                `Shall we move on to the next question?`,  //10th
                                `Are you ready to move on to the next question?`,  //11th
                                `Are you ready to move on?`,  //12th
                                `Are you ready for the next question?`,  //13th
                            ]
                        }),

                        assign({
                            correctCongrats: (context, event) => [
                                `Correct! That was the right answer. You just earned $500!`,  //1st
                                `That was the correct answer. You just doubled your winnings!`, //2nd
                                `Congrats, ${context.username}! It was the right answer. You just earned another $1000!`, //3rd
                                `Awesome! It was the correct answer. You're at $5000!`, //4th
                                `That was indeed the right answer. You doubled your reward!`, //5th
                                `Correct! It was the answer. You just earned 10000$!`, //6th
                                `Congrats! The answer was what you said. You are at $50000!`, //7th
                                `Great job, ${context.username}! It was the right answer. You just earned $25000 more!`, //8th
                                `Correct! That was the answer. You doubled your winnings again!`, //9th
                                `Awesome! It was the right answer. You now have $250000`, //10th
                                `That was the right correct answer. You doubled your potential reward!`, //11th
                                `Correct! It was the right answer. Congratulations! This was your last question, which means you just won a million dollars! You are a millionaire!`, //12th
                            ]
                        }),

                        assign({
                            moneyStages: (context, event) => [
                                `$500`,  //1st
                                `$1000`,  //2nd
                                `$2000`,  //3rd
                                `$5000`,  //4th
                                `$10000`,  //5th
                                `$20000`,  //6th
                                `$50000`,  //7th
                                `$75000`,  //8th
                                `$150000`,  //9th
                                `$250000`,  //10th
                                `$500000`,  //11th
                                `$1000000`,  //12th
                            ]
                        }),
                      
                        (context, event) => console.log(context, event),
                        (context, event) => console.log(event.data.results[0])

                    ]
                },
                onError: {
                    target: 'init'
                }
            }
        },

        playMillionaire: {
            initial: 'competitionQuestion',
            states: {
                hist: {
                    type: 'history'
                },

                competitionQuestion: {  // change
                    initial: 'choose',
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.getHelp',
                                cond: (context) => context.recResult[0].utterance.indexOf("help") !== -1 || context.recResult[0].utterance.indexOf("Help") !== -1
                            },
                            {
                                target: '#root.dm.init',
                                cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                            },
                            {
                                target: '.choose',
                                cond: (context) => context.recResult[0].utterance.indexOf("repeat") !== -1 || context.recResult[0].utterance.indexOf("Repeat") !== -1
                            },
                            {
                                target: '.switchQuestion',
                                cond: (context) => context.recResult[0].utterance.indexOf("switch") !== -1 || context.recResult[0].utterance.indexOf("Switch") !== -1 ||
                                    context.recResult[0].utterance.indexOf("change") !== -1 || context.recResult[0].utterance.indexOf("Change") !== -1,
                                actions: assign({ counter: (context) => 0 })
                            },
                            {
                                target: '.fiftyFifty',
                                cond: (context) => context.recResult[0].utterance.indexOf("fifty") !== -1 || context.recResult[0].utterance.indexOf("Fifty") !== -1 ||
                                    context.recResult[0].utterance.indexOf("50") !== -1 || context.recResult[0].utterance.indexOf("5050") !== -1,
                                actions: assign({ counter: (context) => 0 })
                            },
                            {
                                target: '.check',
                                cond: (context) => context.recResult[0].utterance.indexOf("first") !== -1 || context.recResult[0].utterance.indexOf("one") !== -1 || context.recResult[0].utterance.indexOf("1st") !== -1 ||
                                    context.recResult[0].utterance.indexOf("1") !== -1 || context.recResult[0].utterance.indexOf("One") !== -1 || context.recResult[0].utterance.indexOf("First") !== -1,
                                actions: assign({ uncertainAnswer: (context) => "1" })
                            },
                            {
                                target: '.check', 
                                cond: (context) => context.recResult[0].utterance.indexOf("second") !== -1 || context.recResult[0].utterance.indexOf("two") !== -1 || context.recResult[0].utterance.indexOf("2nd") !== -1 ||
                                    context.recResult[0].utterance.indexOf("2") !== -1 || context.recResult[0].utterance.indexOf("Two") !== -1 || context.recResult[0].utterance.indexOf("Second") !== -1,
                                actions: assign({ uncertainAnswer: (context) => "2" })
                            },
                            {
                                target: '.check', 
                                cond: (context) => context.recResult[0].utterance.indexOf("third") !== -1 || context.recResult[0].utterance.indexOf("three") !== -1 || context.recResult[0].utterance.indexOf("3rd") !== -1 ||
                                    context.recResult[0].utterance.indexOf("3") !== -1 || context.recResult[0].utterance.indexOf("Three") !== -1 || context.recResult[0].utterance.indexOf("Third") !== -1,
                                actions: [assign({ counter: (context) => 0 }), assign({ uncertainAnswer: (context) => "3" })]
                            },
                            {
                                target: '.check',
                                cond: (context) => context.recResult[0].utterance.indexOf("fourth") !== -1 || context.recResult[0].utterance.indexOf("four") !== -1 || context.recResult[0].utterance.indexOf("4th") !== -1 ||
                                    context.recResult[0].utterance.indexOf("4") !== -1 || context.recResult[0].utterance.indexOf("Four") !== -1 || context.recResult[0].utterance.indexOf("Fourth") !== -1,
                                actions: [assign({ counter: (context) => 0 }), assign({ uncertainAnswer: (context) => "4" })]
                            },
                            {
                                target: '.nomatch',
                                actions: assign({ counter: (context) => context.counter + 1 })
                            },
                        ],
                        TIMEOUT: { actions: assign({ counter: (context) => context.counter + 1 }), target: '.choose' }
                    },
                    states: {
                        choose: {
                            always: [
                                { target: 'prompt1', cond: (context) => context.counter === 0 },
                                { target: 'prompt2', cond: (context) => context.counter === 1 },
                                { target: 'prompt3', cond: (context) => context.counter === 2 },
                                { target: 'youFailed', cond: (context) => context.counter === 3 },
                            ]
                        },
                        prompt1: {
                            entry: send((context) => ({ 
                                type: 'SPEAK', 
                                value: context.questions1[context.currentQuestion]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        prompt2: {
                            entry: send((context) => ({ 
                                type: 'SPEAK', 
                                value: context.questions2[context.currentQuestion]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        prompt3: {
                            entry: send((context) => ({ 
                                type: 'SPEAK', 
                                value: context.questions3[context.currentQuestion]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        ask: {
                            entry: send('LISTEN'),
                        },
                        nomatch: {
                            entry: say("Sorry, I did not get that."),
                            on: { ENDSPEECH: '#root.dm.playMillionaire.competitionQuestion' } 
                        },
                        // check if sure
                        check: {
                            initial: 'makeSure',
                            on: {
                                RECOGNISED: [
                                    {
                                        target: 'goodJob',
                                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                            context.correctAnswers[context.currentQuestion] === context.allAnswersTotal[context.currentQuestion][Number(context.uncertainAnswer) - 1] &&
                                            context.currentQuestion === 1, // change
                                        actions: [
                                            assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }),
                                            assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 }),
                                            assign({ safePoint: (context) => '$1000' })
                                        ], // safe step
                                    },
                                    {
                                        target: 'goodJob',
                                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                            context.correctAnswers[context.currentQuestion] === context.allAnswersTotal[context.currentQuestion][Number(context.uncertainAnswer) - 1] &&
                                            context.currentQuestion === 6, // change
                                        actions: [
                                            assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }),
                                            assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 }),
                                            assign({ safePoint: (context) => '$50000' })
                                        ], // safe step
                                    },
                                    {
                                        target: 'goodJob',
                                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                            context.correctAnswers[context.currentQuestion] === context.allAnswersTotal[context.currentQuestion][Number(context.uncertainAnswer) - 1] &&
                                            context.currentQuestion !== 1 && context.currentQuestion !== 6, // change
                                        actions: [assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }), assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 })], // add safe step whenever necessary
                                    },
                                    {
                                        target: 'youFailed',
                                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                            context.correctAnswers[context.currentQuestion] !== context.allAnswersTotal[context.currentQuestion][Number(context.uncertainAnswer) - 1],
                                    },
                                    {
                                        target: '#root.dm.playMillionaire.competitionQuestion', // change
                                        cond: (context) => "negation" in (ans_grammar[context.recResult[0].utterance] || {}),
                                        actions: assign({ counter: (context) => context.counter + 1 }),
                                    },
                                    {
                                        target: '.nomatch',
                                    }
                                ],
                                TIMEOUT: { target: '.makeSure' }
                            },
                            states: {
                                makeSure: {
                                    entry: send((context) => ({
                                        type: 'SPEAK',
                                        value: context.finalAnswer[context.currentQuestion] // change
                                    })),
                                    on: {
                                        ENDSPEECH: 'ask'
                                    }
                                },
                                ask: {
                                    entry: send('LISTEN'),
                                },
                                nomatch: {
                                    entry: say("Sorry, I did not get that."),
                                    on: { ENDSPEECH: 'makeSure' }
                                },

                            },
                        },

                        // lifelines
                        // 50/50
                        fiftyFifty: {
                            initial: 'choose',
                            on: {
                                RECOGNISED: [
                                    {
                                        target: '#root.dm.init',
                                        cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                                    },
                                    {
                                        target: '.choose',
                                        cond: (context) => context.recResult[0].utterance.indexOf("repeat") !== -1 || context.recResult[0].utterance.indexOf("Repeat") !== -1
                                    },
                                    {
                                        target: '.check', 
                                        cond: (context) => context.recResult[0].utterance.indexOf("first") !== -1 || context.recResult[0].utterance.indexOf("one") !== -1 || context.recResult[0].utterance.indexOf("1st") !== -1 ||
                                            context.recResult[0].utterance.indexOf("1") !== -1 || context.recResult[0].utterance.indexOf("One") !== -1 || context.recResult[0].utterance.indexOf("First") !== -1,
                                        actions: assign({ uncertainAnswer: (context) => "1" })
                                    },
                                    {
                                        target: '.check', 
                                        cond: (context) => context.recResult[0].utterance.indexOf("second") !== -1 || context.recResult[0].utterance.indexOf("two") !== -1 || context.recResult[0].utterance.indexOf("2nd") !== -1 ||
                                            context.recResult[0].utterance.indexOf("2") !== -1 || context.recResult[0].utterance.indexOf("Two") !== -1 || context.recResult[0].utterance.indexOf("Second") !== -1,
                                        actions: assign({ uncertainAnswer: (context) => "2" })
                                    },
                                    {
                                        target: '.nomatch',
                                        actions: assign({ counter: (context) => context.counter + 1 })
                                    }
                                ],
                                TIMEOUT: { target: '.choose', actions: assign({ counter: (context) => context.counter + 1 }) }
                            },
                            states: {
                                choose: {
                                    always: [
                                        { target: 'goBack', cond: (context) => context.fiftyFiftyCounter !== 0 },
                                        { target: 'reducedQuestion1', cond: (context) => context.counter === 0 && context.fiftyFiftyCounter === 0 },
                                        { target: 'reducedQuestion2', cond: (context) => context.counter === 1 && context.fiftyFiftyCounter === 0 },
                                        { target: 'reducedQuestion3', cond: (context) => context.counter === 2 && context.fiftyFiftyCounter === 0 },
                                        { target: '#root.dm.playMillionaire.competitionQuestion.youFailed', cond: (context) => context.counter === 3 }, // change
                                    ]
                                },
                                goBack: {
                                    entry: send((context) => ({
                                        type: 'SPEAK',
                                        value: `I am sorry, but you have already used up your fifty-fifty lifeline.`
                                    })),
                                    on: {
                                        ENDSPEECH: '#root.dm.playMillionaire.competitionQuestion' 
                                    }
                                },
                                reducedQuestion1: {
                                    entry: send((context) => ({
                                        type: 'SPEAK',
                                        value: context.questions5050_1[context.currentQuestion]
                                    })),
                                    on: {
                                        ENDSPEECH: 'ask'
                                    }
                                },
                                reducedQuestion2: {
                                    entry: send((context) => ({
                                        type: 'SPEAK',
                                        value: context.questions5050_2[context.currentQuestion]
                                    })),
                                    on: {
                                        ENDSPEECH: 'ask'
                                    }
                                },
                                reducedQuestion3: {
                                    entry: send((context) => ({
                                        type: 'SPEAK',
                                        value: context.questions5050_3[context.currentQuestion]
                                    })),
                                    on: {
                                        ENDSPEECH: 'ask'
                                    }
                                },
                                ask: {
                                    entry: send('LISTEN'),
                                },
                                nomatch: {
                                    entry: say("Sorry, I did not get that."),
                                    on: { ENDSPEECH: 'choose' }
                                },
                                check: {
                                    initial: 'makeSure',
                                    on: {
                                        RECOGNISED: [
                                            {
                                                target: '#root.dm.playMillionaire.competitionQuestion.goodJob',
                                                cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                                    context.correctAnswers[context.currentQuestion] === context.all5050Answers[context.currentQuestion][Number(context.uncertainAnswer) - 1] &&
                                                    context.currentQuestion === 1, // change
                                                actions: [
                                                    assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }),
                                                    assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 }),
                                                    assign({ safePoint: (context) => '$1000' }),
                                                    assign({ fiftyFiftyCounter: (context) => 1 })
                                                ], // safe step
                                            },
                                            {
                                                target: '#root.dm.playMillionaire.competitionQuestion.goodJob',
                                                cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                                    context.correctAnswers[context.currentQuestion] === context.all5050Answers[context.currentQuestion][Number(context.uncertainAnswer) - 1] &&
                                                    context.currentQuestion === 6, // change
                                                actions: [
                                                    assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }),
                                                    assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 }),
                                                    assign({ safePoint: (context) => '$50000' }),
                                                    assign({ fiftyFiftyCounter: (context) => 1 })
                                                ], // safe step
                                            },
                                            {
                                                target: '#root.dm.playMillionaire.competitionQuestion.goodJob',
                                                cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                                    context.correctAnswers[context.currentQuestion] === context.all5050Answers[context.currentQuestion][Number(context.uncertainAnswer) - 1] &&
                                                    context.currentQuestion !== 1 && context.currentQuestion !== 6, 
                                                actions: [
                                                    assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }),
                                                    assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 }),
                                                    assign({ fiftyFiftyCounter: (context) => 1 })
                                                ], 
                                            },
                                            {
                                                target: '#root.dm.playMillionaire.competitionQuestion.youFailed',
                                                cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                                    context.correctAnswers[context.currentQuestion] !== context.all5050Answers[context.currentQuestion][Number(context.uncertainAnswer) - 1],
                                            },
                                            {
                                                target: '#root.dm.playMillionaire.competitionQuestion.fiftyFifty', 
                                                cond: (context) => "negation" in (ans_grammar[context.recResult[0].utterance] || {}),
                                                actions: assign({ counter: (context) => context.counter + 1 }),
                                            },
                                            {
                                                target: '.nomatch',
                                            }
                                        ],
                                        TIMEOUT: { target: '.makeSure' }
                                    },
                                    states: {
                                        makeSure: {
                                            entry: send((context) => ({
                                                type: 'SPEAK',
                                                value: context.finalAnswer[context.currentQuestion]
                                            })),
                                            on: {
                                                ENDSPEECH: 'ask'
                                            }
                                        },
                                        ask: {
                                            entry: send('LISTEN'),
                                        },
                                        nomatch: {
                                            entry: say("Sorry, I did not get that."),
                                            on: { ENDSPEECH: 'makeSure' }
                                        },
                                    },
                                },
                            },
                        },
                        // switchQuestion
                        switchQuestion: {
                            initial: 'choose',
                            states: {
                                choose: {
                                    always: [
                                        { target: 'goBack', cond: (context) => context.switchCounter !== 0 },
                                        { target: 'changeQuestion', cond: (context) => context.switchCounter === 0 },
                                    ]
                                },
                                changeQuestion: {
                                    entry: [send((context) => ({
                                        type: 'SPEAK',
                                        value: `Okay, let me change your question to our backup question`
                                    })),
                                        assign({ switchCounter: (context) => 1 })],
                                    on: { ENDSPEECH: '#root.dm.playMillionaire.extraQuestion' }
                                },
                                goBack: {
                                    entry: send((context) => ({
                                        type: 'SPEAK',
                                        value: `I am sorry, but you have already used up your switch question lifeline.`
                                    })),
                                    on: {
                                        ENDSPEECH: '#root.dm.playMillionaire.competitionQuestion' 
                                    }
                                },
                            }
                        },
                        
                        // final states
                        goodJob: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: context.correctCongrats[context.currentQuestion-1] // change
                            })),
                            on: { ENDSPEECH: '#root.dm.playMillionaire.chitChat' }
                        },
                        youFailed: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `I'm sorry, but the correct answer was ${context.correctAnswers[context.currentQuestion]}. You will have to go home with ${context.safePoint}` // change
                            })),
                            on: { ENDSPEECH: '#root.dm.init' }
                        },
                    }
                },

                // extra question for change question lifeline
                extraQuestion: {
                    initial: 'choose',
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.getHelp',
                                cond: (context) => context.recResult[0].utterance.indexOf("help") !== -1 || context.recResult[0].utterance.indexOf("Help") !== -1
                            },
                            {
                                target: '#root.dm.init',
                                cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                            },
                            {
                                target: '.choose',
                                cond: (context) => context.recResult[0].utterance.indexOf("repeat") !== -1 || context.recResult[0].utterance.indexOf("Repeat") !== -1
                            },
                            {
                                target: '.check',
                                cond: (context) => context.recResult[0].utterance.indexOf("first") !== -1 || context.recResult[0].utterance.indexOf("one") !== -1 || context.recResult[0].utterance.indexOf("1st") !== -1 ||
                                    context.recResult[0].utterance.indexOf("1") !== -1 || context.recResult[0].utterance.indexOf("One") !== -1 || context.recResult[0].utterance.indexOf("First") !== -1,
                                actions: assign({ uncertainAnswer: (context) => "1" })
                            },
                            {
                                target: '.check',
                                cond: (context) => context.recResult[0].utterance.indexOf("second") !== -1 || context.recResult[0].utterance.indexOf("two") !== -1 || context.recResult[0].utterance.indexOf("2nd") !== -1 ||
                                    context.recResult[0].utterance.indexOf("2") !== -1 || context.recResult[0].utterance.indexOf("Two") !== -1 || context.recResult[0].utterance.indexOf("Second") !== -1,
                                actions: assign({ uncertainAnswer: (context) => "2" })
                            },
                            {
                                target: '.check',
                                cond: (context) => context.recResult[0].utterance.indexOf("third") !== -1 || context.recResult[0].utterance.indexOf("three") !== -1 || context.recResult[0].utterance.indexOf("3rd") !== -1 ||
                                    context.recResult[0].utterance.indexOf("3") !== -1 || context.recResult[0].utterance.indexOf("Three") !== -1 || context.recResult[0].utterance.indexOf("Third") !== -1,
                                actions: [assign({ counter: (context) => 0 }), assign({ uncertainAnswer: (context) => "3" })]
                            },
                            {
                                target: '.check',
                                cond: (context) => context.recResult[0].utterance.indexOf("fourth") !== -1 || context.recResult[0].utterance.indexOf("four") !== -1 || context.recResult[0].utterance.indexOf("4th") !== -1 ||
                                    context.recResult[0].utterance.indexOf("4") !== -1 || context.recResult[0].utterance.indexOf("Four") !== -1 || context.recResult[0].utterance.indexOf("Fourth") !== -1,
                                actions: [assign({ counter: (context) => 0 }), assign({ uncertainAnswer: (context) => "4" })]
                            },
                            {
                                target: '.nomatch',
                                actions: assign({ counter: (context) => context.counter + 1 })
                            },
                        ],
                        TIMEOUT: { actions: assign({ counter: (context) => context.counter + 1 }), target: '.choose' }
                    },
                    states: {
                        choose: {
                            always: [
                                { target: 'prompt1', cond: (context) => context.counter === 0 },
                                { target: 'prompt2', cond: (context) => context.counter === 1 },
                                { target: 'prompt3', cond: (context) => context.counter === 2 },
                                { target: 'youFailed', cond: (context) => context.counter === 3 },
                            ]
                        },
                        prompt1: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: context.questions1[12]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        prompt2: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: context.questions2[12]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        prompt3: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: context.questions3[12]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        ask: {
                            entry: send('LISTEN'),
                        },
                        nomatch: {
                            entry: say("Sorry, I did not get that."),
                            on: { ENDSPEECH: '#root.dm.playMillionaire.extraQuestion' }
                        },
                        // check if sure
                        check: {
                            initial: 'makeSure',
                            on: {
                                RECOGNISED: [
                                    {
                                        target: 'goodJob',
                                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                            context.correctAnswers[12] === context.allAnswersTotal[12][Number(context.uncertainAnswer) - 1] &&
                                            context.currentQuestion === 1, // change
                                        actions: [
                                            assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }),
                                            assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 }),
                                            assign({ safePoint: (context) => '$1000' }),
                                            assign({ switchCounter: (context) => 1 })
                                        ], // safe step
                                    },
                                    {
                                        target: 'goodJob',
                                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                            context.correctAnswers[12] === context.allAnswersTotal[12][Number(context.uncertainAnswer) - 1] &&
                                            context.currentQuestion === 6, // change
                                        actions: [
                                            assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }),
                                            assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 }),
                                            assign({ safePoint: (context) => '$50000' }),
                                            assign({ switchCounter: (context) => 1 })
                                        ], // safe step
                                    },
                                    {
                                        target: 'goodJob',
                                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                            context.correctAnswers[12] === context.allAnswersTotal[12][Number(context.uncertainAnswer) - 1] &&
                                            context.currentQuestion !== 1 && context.currentQuestion !== 6, // change
                                        actions: [
                                            assign({ counter: (context) => 0 }), assign({ currentMoney: (context) => context.moneyStages[context.currentQuestion] }),
                                            assign({ currentQuestion: (context) => context.currentQuestion + 1 }), assign({ remainingQuestions: (context) => context.remainingQuestions - 1 }),
                                            assign({ switchCounter: (context) => 1 })
                                        ], 
                                    },
                                    {
                                        target: 'youFailed',
                                        cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}) &&
                                            context.correctAnswers[12] !== context.allAnswersTotal[12][Number(context.uncertainAnswer) - 1],
                                    },
                                    {
                                        target: '#root.dm.playMillionaire.extraQuestion', // change
                                        cond: (context) => "negation" in (ans_grammar[context.recResult[0].utterance] || {}),
                                        actions: assign({ counter: (context) => context.counter + 1 }),
                                    },
                                    {
                                        target: '.nomatch',
                                    }
                                ],
                                TIMEOUT: { target: '.makeSure' }
                            },
                            states: {
                                makeSure: {
                                    entry: send((context) => ({
                                        type: 'SPEAK',
                                        value: context.finalAnswer[12] // change
                                    })),
                                    on: {
                                        ENDSPEECH: 'ask'
                                    }
                                },
                                ask: {
                                    entry: send('LISTEN'),
                                },
                                nomatch: {
                                    entry: say("Sorry, I did not get that."),
                                    on: { ENDSPEECH: 'makeSure' }
                                },

                            },
                        },

                        // final states
                        goodJob: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: context.correctCongrats[context.currentQuestion - 1] // change
                            })),
                            on: { ENDSPEECH: '#root.dm.playMillionaire.chitChat' }
                        },
                        youFailed: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `I'm sorry, but the correct answer was ${context.correctAnswers[12]}. You will have to go home with ${context.safePoint}` // change
                            })),
                            on: { ENDSPEECH: '#root.dm.init' }
                        },
                    }
                },

                chitChat: {
                    initial: 'choose',
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.getHelp',
                                cond: (context) => context.recResult[0].utterance.indexOf("help") !== -1 || context.recResult[0].utterance.indexOf("Help") !== -1
                            },
                            {
                                target: '#root.dm.init',
                                cond: (context) => context.recResult[0].utterance.indexOf("quit") !== -1 || context.recResult[0].utterance.indexOf("Quit") !== -1
                            },
                            {
                                target: '.choose',
                                cond: (context) => context.recResult[0].utterance.indexOf("repeat") !== -1 || context.recResult[0].utterance.indexOf("Repeat") !== -1
                            },
                            {
                                target: '.leave',
                                cond: (context) => context.recResult[0].utterance.indexOf("leave") !== -1 || context.recResult[0].utterance.indexOf("Leave") !== -1
                            },
                            {
                                target: '.checkMoney',
                                cond: (context) => context.recResult[0].utterance.indexOf("money") !== -1 || context.recResult[0].utterance.indexOf("Money") !== -1
                            },
                            {
                                target: '.checkQuestions',
                                cond: (context) => context.recResult[0].utterance.indexOf("questions") !== -1 || context.recResult[0].utterance.indexOf("Questions") !== -1
                            },
                            {
                                target: '#root.dm.playMillionaire.competitionQuestion',
                                cond: (context) => "confirmation" in (ans_grammar[context.recResult[0].utterance] || {}),
                                actions: assign({ counter: (context) => 0 })
                            },
                            {
                                target: '.negation',
                                cond: (context) => "negation" in (ans_grammar[context.recResult[0].utterance] || {}),
                                actions: assign({ counter: (context) => context.counter + 1 }),
                            },
                            {
                                target: '.nomatch',
                                actions: assign({ counter: (context) => context.counter + 1 })
                            },
                        ],
                        TIMEOUT: { actions: assign({ counter: (context) => context.counter + 1 }), target: '.choose' }
                    },
                    states: {
                        choose: {
                            always: [
                                { target: '#root.dm.init', cond: (context) => context.currentQuestion === 12 },
                                { target: 'prompt1', cond: (context) => context.counter === 0 },
                                { target: 'prompt2', cond: (context) => context.counter === 1 },
                                { target: 'prompt3', cond: (context) => context.counter === 2 },
                                { target: '#root.dm.init', cond: (context) => context.counter === 3 },
                            ]
                        },
                        prompt1: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: context.chitChat1[context.currentQuestion-1]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        prompt2: {
                            entry: send((context) => ({
                                type: 'SPEAK', 
                                value: context.chitChat2[context.currentQuestion - 1]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        prompt3: {
                            entry: send((context) => ({
                                type: 'SPEAK', 
                                value: context.chitChat3[context.currentQuestion - 1]
                            })),
                            on: {
                                ENDSPEECH: 'ask'
                            }
                        },
                        ask: {
                            entry: send('LISTEN'),
                        },
                        nomatch: {
                            entry: say("Sorry, I did not get that."),
                            on: { ENDSPEECH: '#root.dm.playMillionaire.chitChat' }
                        },
                        leave: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `Okay! Thank you for playing, and you will now leave with ${context.currentMoney}`
                            })),
                            on: { ENDSPEECH: '#root.dm.init' }
                        },
                        checkMoney: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `Let me have a look: your current potential winnings are ${context.currentMoney}, and your safety spot lies at ${context.safePoint}`
                            })),
                            on: { ENDSPEECH: '#root.dm.playMillionaire.chitChat' }
                        },
                        checkQuestions: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `Let me have a look. You just answered ${context.currentQuestion}, so you still have ${context.remainingQuestions} left to answer!`
                            })),
                            on: { ENDSPEECH: '#root.dm.playMillionaire.chitChat' }
                        },
                        negation: {
                            entry: send((context) => ({
                                type: 'SPEAK',
                                value: `I am sorry, but you must proceed or decide to leave now!`
                            })),
                            on: { ENDSPEECH: '#root.dm.playMillionaire.chitChat' }
                        },        
                    }
                },
            }
        },
    }
})


