import React, {useRef} from 'react';

const questions={
  batch:['What does this batch contain?','Which sources should I check for the main events in the Batch Brief?'],
  expert:['What alternative explanations fit the material in this batch?','What counterevidence and source checks would distinguish those explanations?']
};

export default function AssistantExamples({assistant,onQuestion,disabled}) {
  const panel=useRef(null);
  function choose(question) {
    onQuestion(question);
    panel.current?.closest('.cdr-chat,.cdr-detective-chat')?.querySelector('form textarea')?.focus();
  }
  return <div className="assistant-examples" ref={panel}><p>Try a question <small>· fills the input for you to review</small></p><div>{questions[assistant].map(question=><button key={question} type="button" disabled={disabled} onClick={()=>choose(question)}>{question}</button>)}</div></div>;
}
