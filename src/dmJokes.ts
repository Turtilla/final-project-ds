/*
S> What kind of joke do you want to hear?
U> programming
S> Here you go!
S> Debugging is like being the detective in a crime movie where you're also the murderer at the same time.
U> HAHAHA
S> What's funny?
U> ....
S> I see!

S> What kind of joke do you want to hear?
U> blabla
S> I don't know any jokes of this kind. What kind of joke do you want to hear?

*/

import { MachineConfig, send, assign, Action } from "xstate";

function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const categGrammar: { [index: string]: string } = {
    "Programming.": "Programming",
    "Programmers.": "Programming",
    "Tell me a pun.": "Pun",
    "puns": "Pun"
}

const jokeRequest = (category: string) =>
    fetch(new Request(`https://v2.jokeapi.dev/joke/${category}?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=single`)).then(data => data.json())


function askCategory(prompt: string): MachineConfig<SDSContext, any, SDSEvent> {
    return {
        initial: 'prompt',
        on: {
            RECOGNISED: [
                {
                    target: 'tellJoke',
                    cond: (context) => context.recResult[0].utterance in categGrammar,
                    actions: assign({ category: (context) => categGrammar[context.recResult[0].utterance] })
                },
                {
                    target: '.nomatch'
                }
            ]
        },
        states: {
            prompt: {
                entry: say(prompt),
                on: { ENDSPEECH: 'ask' }
            },
            ask: {
                entry: send('LISTEN')
            },
            nomatch: {
                entry: say("I don't know any jokes of this kind."),
                on: { ENDSPEECH: 'prompt' }
            }
        }
    }
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
                TTS_READY: 'welcome',
                CLICK: 'welcome'
            }
        },
        welcome: {
            ...askCategory("What kind of joke do you want to hear?")
        },
        tellJoke: {
            initial: 'prompt',
            states: {
                prompt: {
                    entry: say("Here we go."),
                    on: { ENDSPEECH: 'getJoke' }
                },
                getJoke: {
                    invoke: {
                        id: 'getJoke',
                        src: (context, event) => jokeRequest(context.category),
                        onDone: {
                            target: 'success',
                            actions: [
                                assign({ joke: (context, event) => event.data.joke }),
                                (context, event) => console.log(context, event)
                            ]
                        },
                        onError: {
                            target: 'fail',
                            actions: (context, event) => console.log(context, event)
                        }
                    }
                },
                success: {
                    entry: send((context: SDSContext) => ({
                        type: "SPEAK", value: context.joke
                    })),
                    on: { ENDSPEECH: '#root.dm.anotherJoke' }
                },
                fail: {},
            },
        },
        anotherJoke: {
            ...askCategory("Do you want to hear something else?")
        }
    }
})
