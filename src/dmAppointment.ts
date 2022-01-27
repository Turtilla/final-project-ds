import { MachineConfig, send, Action, assign } from "xstate";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const grammar:{ [index: string]: { title?: string, day?: string, time?: string } }  = {
    "Lecture.": { title: "Dialogue systems lecture"},
    "Lunch.": { title: "Lunch at coffeeshop"},
    "on Friday": { day: "Friday" },
    "at ten": { time: "10:00" },
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
            initial: 'prompt',
            on :{
                RECOGNISED: [
                    {target: 'info',
                     cond: (context)=>"title" in (grammar[context.recResult[0].utterance] || {}),
                     actions: assign({title: (context)=> grammar[context.recResult[0].utterance].title!})
                 }
                ]
            },
            states: {
                prompt: {
                    entry: send({
                        type : 'SPEAK',
                        value : "Let's create an appointment. What is it about?"
                     }),
                    
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
            }
        },

        info: {
            entry: send({
                type: 'SPEAK',
                value: "OK, Doctor's appointment",
            }),
            on: {ENDSPEECH: 'init'}
        }
    }
})
