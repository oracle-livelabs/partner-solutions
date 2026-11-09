"""V3: retain the approved voice, add case context, phrasing and wider intonation."""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import soundfile as sf
from onnx import helper, numpy_helper, TensorProto
from kokoro_onnx import Kokoro

parser=argparse.ArgumentParser()
parser.add_argument('--case',required=True,type=Path)
parser.add_argument('--build',required=True,type=Path)
parser.add_argument('--out',required=True,type=Path)
parser.add_argument('--models',required=True,type=Path)
parser.add_argument('--expressive-model',type=Path)
parser.add_argument('--sample',action='store_true')
args=parser.parse_args()
BUILD=args.build.resolve(); OUT=args.out.resolve(); MODELS=args.models.resolve()
BUILD.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
case=json.loads(args.case.read_text())

# Expand the model's existing pitch contour BEFORE waveform synthesis, rather
# than shifting the finished recording. Voice embeddings and phonemes stay V2.
# Kokoro's official model.py sends F0_proj into the decoder's F0 conditioning.
modified=args.expressive_model.resolve() if args.expressive_model else BUILD/'kokoro-expressive.onnx'
if not modified.exists():
    graph=onnx.load(MODELS/'kokoro-v1.0.onnx')
    original='/F0_proj/Conv_output_0'
    nodes=list(graph.graph.node)
    index=next(i for i,n in enumerate(nodes) if original in n.output)
    final='v3_pitch_contour'
    for n in nodes[index+1:]:
        for i,name in enumerate(n.input):
            if name==original: n.input[i]=final
    for name,value in [('v3_voiced_floor',70.),('v3_zero',0.),('v3_one',1.),('v3_range',1.30),('v3_low',75.),('v3_high',420.)]:
        graph.graph.initializer.append(numpy_helper.from_array(np.array(value,dtype=np.float32),name))
    h=helper.make_node
    additions=[
        h('Greater',[original,'v3_voiced_floor'],['v3_voiced']),
        h('Cast',['v3_voiced'],['v3_mask'],to=TensorProto.FLOAT),
        h('Where',['v3_voiced',original,'v3_zero'],['v3_voiced_pitch']),
        h('ReduceSum',['v3_voiced_pitch'],['v3_sum'],keepdims=1),
        h('ReduceSum',['v3_mask'],['v3_count'],keepdims=1),
        h('Max',['v3_count','v3_one'],['v3_safe_count']),
        h('Div',['v3_sum','v3_safe_count'],['v3_center']),
        h('Sub',[original,'v3_center'],['v3_deviation']),
        h('Mul',['v3_deviation','v3_range'],['v3_wider']),
        h('Add',['v3_center','v3_wider'],['v3_expanded']),
        h('Clip',['v3_expanded','v3_low','v3_high'],['v3_bounded']),
        h('Where',['v3_voiced','v3_bounded',original],[final]),
    ]
    del graph.graph.node[:]
    graph.graph.node.extend(nodes[:index+1]+additions+nodes[index+1:])
    # Keep waveform and duration first, with diagnostics as extra outputs.
    graph.graph.output.extend([helper.make_tensor_value_info(original,TensorProto.FLOAT,[None,None,None]),helper.make_tensor_value_info(final,TensorProto.FLOAT,[None,None,None])])
    onnx.checker.check_model(graph)
    onnx.save(graph,modified)

class Narrator(Kokoro):
    def _infer(self,tokens,style,speed):
        outputs=self.sess.run(None,{
            self._tokens_input:np.array([[0,*tokens,0]],dtype=self._input_dtypes[self._tokens_input]),
            'style':np.asarray(style,dtype=self._input_dtypes['style']),
            'speed':np.array([self._speed_value(speed)],dtype=self._input_dtypes['speed']),
        })
        old,new=outputs[2].ravel(),outputs[3].ravel()
        mask=old>70
        self.pitch_checks.append({'originalPitchStdHz':float(np.std(old[mask])), 'expressivePitchStdHz':float(np.std(new[mask])), 'originalPitchMeanHz':float(np.mean(old[mask])), 'expressivePitchMeanHz':float(np.mean(new[mask]))})
        return np.asarray(outputs[0]).ravel(),np.asarray(outputs[1]).ravel()

ort.disable_telemetry_events()
options=ort.SessionOptions(); options.intra_op_num_threads=4; options.inter_op_num_threads=1
session=ort.InferenceSession(str(modified),sess_options=options,providers=['CPUExecutionProvider'])
model=Narrator.from_session(session,str(MODELS/'voices-v1.0.bin'))
model.pitch_checks=[]
voice=.65*model.get_voice_style('ff_siwis')+.35*model.get_voice_style('bf_emma')
scenes=case['scenes']
assert scenes and len({s['id'] for s in scenes})==len(scenes)
assert all(re.fullmatch(r'[a-z0-9-]+',s['id']) for s in scenes)
(BUILD/'narrative.json').write_text(json.dumps(scenes,indent=2))
sequence=0; qc=[]; preview=[]
def caption_sized_segments(text):
    # Keep every spoken word; split long sentences at a natural clause/word
    # boundary before synthesis so each caption has exact audio timing.
    parts=[]
    for sentence in [x.strip() for x in re.findall(r'[^.!?]+[.!?]+|[^.!?]+$',text) if x.strip()]:
        while len(sentence)>180:
            window=sentence[:181]
            cut=max(window.rfind(', ',70),window.rfind('; ',70),window.rfind(': ',70))
            if cut<0:cut=window.rfind(' ')
            assert cut>0,'Unbreakable narration token'
            if sentence[cut] in ',;:':cut+=1
            parts.append(sentence[:cut].strip())
            sentence=sentence[cut:].strip()
        if sentence:parts.append(sentence)
    assert ' '.join(parts).split()==text.split(),'Narration segmentation changed words'
    return parts
for scene in scenes[:1] if args.sample else scenes:
    scene['segments']=[]
    sentences=caption_sized_segments(scene['narration'])
    for local_index,text in enumerate(sentences):
        sequence+=1
        pace=scene.get('pace',1.01 if scene['id'] in ('money','messages') else 1.055)+[0.,-.02,.015,-.01][local_index%4]
        # Commas, colons and semicolons receive a brief breath-sized pause;
        # the question and central statements get a longer reflective beat.
        clause_pause=.21 if scene['id'] in ('money','messages') else .24
        gap=.46 if text.endswith('?') or local_index==0 else [.29,.36,.31][local_index%3]
        if scene['id']=='welcome' and local_index==0: gap=.60
        samples,rate,phonemes=model.create_timed(text,voice,speed=pace,lang='en-gb',sentence_pause=.30,clause_pause=clause_pause)
        peak=float(np.max(np.abs(samples)))
        if peak>.90: samples*=.90/peak
        fade=min(120,len(samples)//100)
        samples[:fade]*=np.linspace(0,1,fade); samples[-fade:]*=np.linspace(1,0,fade)
        target=BUILD/f'{sequence:02d}.wav'
        sf.write(target,samples,rate,subtype='PCM_16')
        duration=len(samples)/rate
        assert duration>.4 and .02<float(np.max(np.abs(samples)))<1
        scene['segments'].append({'text':text,'audio':str(target),'pauseAfter':gap})
        qc.append({'segment':sequence,'text':text,'seconds':duration,'pace':pace,'clausePauseSeconds':clause_pause,'pauseAfterSeconds':gap,'peak':float(np.max(np.abs(samples)))})
        preview.extend([samples,np.zeros(int(gap*rate),dtype=np.float32)])
        print(f'Voiced {sequence:02d}: {scene["id"]} / {duration:.1f}s / pause {gap:.2f}s',flush=True)

sf.write(BUILD/'opening-preview.wav',np.concatenate(preview[:12]),24000,subtype='PCM_16')
if args.sample: raise SystemExit
description='Approved V3 French/British voice blend; expressive neural English narration with breath-sized pauses'
metadata={'voice':description,'engine':'Kokoro 82M v1.0 / kokoro-onnx 0.6.1','presetBlend':{'ff_siwis':.65,'bf_emma':.35},'phonemeLanguage':'en-gb','generatedLocally':True,'sentenceGap':.32,'pitchDeviationScale':1.30,'pitchMethod':'Widen the existing predicted F0 contour about its voiced mean before waveform synthesis; leave unvoiced frames unchanged.','pitchDiagnostic':model.pitch_checks,'segments':qc,'originalModelSHA256':hashlib.sha256((MODELS/'kokoro-v1.0.onnx').read_bytes()).hexdigest(),'expressiveModelSHA256':hashlib.sha256(modified.read_bytes()).hexdigest()}
(BUILD/'scenes.json').write_text(json.dumps(scenes,indent=2))
(BUILD/'voice.json').write_text(json.dumps(metadata,indent=2))
(OUT/'Voice-Production.json').write_text(json.dumps(metadata,indent=2))
transcript='# '+case['title']+' — Video Briefing\n\nBatch: '+case['batch_id']+'\n\n'+case['subtitle']+'\n\nVoice: '+description+'.\n\n'
transcript+='\n'.join(f"### {s['chapter']} — {s['title']}\n\n{s['narration']}\n\nSource: {s['source']}\n" for s in scenes)
(OUT/'Case-Overview-Transcript.md').write_text(transcript)
print(json.dumps({'segments':sequence,'speechSeconds':sum(s['seconds'] for s in qc),'plannedSeconds':sum(s['seconds']+s['pauseAfterSeconds'] for s in qc)+len(scenes)*1.2,'pitchSpreadRatio':float(np.mean([p['expressivePitchStdHz']/p['originalPitchStdHz'] for p in model.pitch_checks]))}),flush=True)
