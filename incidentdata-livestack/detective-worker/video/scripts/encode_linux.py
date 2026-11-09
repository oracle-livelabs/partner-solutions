"""Linux port of the approved timed still-frame compositor; no generative video."""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

p=argparse.ArgumentParser()
p.add_argument('--build',required=True,type=Path)
p.add_argument('--out',required=True,type=Path)
p.add_argument('--timing-only',action='store_true')
a=p.parse_args(); build=a.build.resolve(); out=a.out.resolve()
scenes=json.loads((build/'scenes.json').read_text()); voice=json.loads((build/'voice.json').read_text())
fps=24; rate=24000; width=1920; height=1080
cues=[]; chapters=[]; sounds=[]; clock=0.0
for scene in scenes:
    start=clock; clock+=.65
    for segment in scene['segments']:
        audio=Path(segment['audio']).resolve()
        assert audio.parent==build and audio.suffix=='.wav','Unexpected segment path'
        samples,sr=sf.read(audio,dtype='float32'); assert sr==rate and samples.ndim==1
        assert np.isfinite(samples).all() and .002<float(np.abs(samples).max())<1,'Silent/clipped audio'
        seconds=len(samples)/sr
        cues.append({'start':clock,'end':clock+seconds,'text':segment['text'],'audio':str(audio)})
        sounds.append(samples); clock+=seconds+segment.get('pauseAfter',voice['sentenceGap'])
    clock+=.55
    chapters.append({'id':scene['id'],'title':scene['title'],'start':start,'end':clock})
frames=math.ceil(clock*fps); duration=frames/fps
assert 120<=duration<=240,'Briefing must remain between two and four minutes'
timing={'duration':duration,'voice':voice['voice'],'chapters':chapters,'captions':cues}
(build/'timing.json').write_text(json.dumps(timing,indent=2))
def stamp(seconds,comma=False):
    ms=round(seconds*1000); h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02}{"," if comma else "."}{ms:03}'
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,30)
measure=ImageDraw.Draw(Image.new('RGB',(width,110)))
def lines(text):
    result=[]; line=''
    for word in text.split():
        candidate=(line+' '+word).strip()
        if measure.textlength(candidate,font=font)>1740 and line:
            result.append(line); line=word
        else: line=candidate
    if line: result.append(line)
    assert len(result)<=2,'Caption does not fit reserved 110-pixel band'
    return result
for suffix in ['srt','vtt']:
    text='WEBVTT\n\n' if suffix=='vtt' else ''
    for i,c in enumerate(cues,1):
        text+=f'{i}\n{stamp(c["start"],suffix=="srt")} --> {stamp(c["end"],suffix=="srt")}\n'+ '\n'.join(lines(c['text']))+'\n\n'
    (out/f'Case-Overview.en.{suffix}').write_text(text)
print(f'Timing: {len(cues)} segments, {len(chapters)} chapters, {duration:.3f}s',flush=True)
if a.timing_only: raise SystemExit
final=out/'Case-Overview.mp4'; m4a=out/'Case-Overview-Voiceover.m4a'; partial=out/'Case-Overview.partial.mp4'
assert not final.exists() and not m4a.exists() and not partial.exists(),'Use a fresh run; media is never overwritten'
master=np.zeros(round(duration*rate),dtype=np.float32)
for cue,samples in zip(cues,sounds):
    offset=round(cue['start']*rate); master[offset:offset+len(samples)]=samples
sf.write(build/'master.wav',master,rate,subtype='PCM_16')
images=[Image.open(build/(s['id']+'.png')).convert('RGB') for s in scenes]
assert all(im.size==(width,height) for im in images)
cmd=['ffmpeg','-hide_banner','-loglevel','warning','-nostdin','-n','-f','rawvideo','-pix_fmt','rgb24','-s',f'{width}x{height}','-r',str(fps),'-i','pipe:0','-i',str(build/'master.wav'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','20','-threads','4','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-t',str(duration),str(partial)]
process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
chapter_index=0; cue_index=0; last_chapter=-1; cached_key=None; cached_picture=None
try:
    for f in range(frames):
        t=f/fps
        while chapter_index+1<len(chapters) and t>=chapters[chapter_index]['end']: chapter_index+=1
        while cue_index+1<len(cues) and t>=cues[cue_index]['end']: cue_index+=1
        chapter=chapters[chapter_index]
        if chapter_index!=last_chapter:
            print(f'Encoding {chapter_index+1}/{len(chapters)}: {chapter["title"]}',flush=True); last_chapter=chapter_index
        progress=max(0,min(1,(t-chapter['start'])/(chapter['end']-chapter['start'])))
        zoom=1+.012*progress; w=round(width*zoom); h=round(height*zoom); key=(chapter_index,w,h)
        if key!=cached_key:
            enlarged=images[chapter_index].resize((w,h),Image.Resampling.LANCZOS)
            left=(w-width)//2; top=(h-height)//2
            cached_picture=enlarged.crop((left,top,left+width,top+height)); cached_key=key
        frame=cached_picture.copy()
        fade=min(1,max(0,(t-chapter['start'])/.6))
        if chapter_index and fade<1:
            prev=images[chapter_index-1].resize((1943,1093),Image.Resampling.LANCZOS).crop((11,6,1931,1086))
            frame=Image.blend(prev,frame,fade)
        draw=ImageDraw.Draw(frame); draw.rectangle((0,height-110,width,height),fill=(9,14,10))
        cue=cues[cue_index]
        if cue['start']<=t<=cue['end']:
            caption=lines(cue['text']); line_height=38; y=height-55-(len(caption)-1)*line_height/2
            for line in caption:
                draw.text((width/2,y),line,font=font,fill=(245,247,232),anchor='mm'); y+=line_height
        draw.rectangle((0,height-113,round(width*t/duration),height-110),fill=(161,130,79))
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    assert process.wait()==0,'FFmpeg encoding failed'
except BaseException:
    process.kill(); process.wait(); raise
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-n','-i',str(build/'master.wav'),'-c:a','aac','-b:a','160k',str(m4a)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(partial)],text=True))
video=[s for s in probe['streams'] if s['codec_type']=='video']; audio=[s for s in probe['streams'] if s['codec_type']=='audio']
assert len(video)==len(audio)==1 and video[0]['width']==width and video[0]['height']==height
actual=float(probe['format']['duration']); assert abs(actual-duration)<.2
assert video[0]['r_frame_rate']=='24/1' and video[0]['codec_name']=='h264' and audio[0]['codec_name']=='aac'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-i',str(partial),'-f','null','-'],check=True)
partial.rename(final)
for i,chapter in enumerate(chapters,1):
    t=chapter['start']+min(6,(chapter['end']-chapter['start'])/2)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-n','-ss',str(t),'-i',str(final),'-frames:v','1',str(build/f'review-{i}.png')],check=True)
validation={'durationSeconds':actual,'width':width,'height':height,'fps':fps,'videoTracks':len(video),'audioTracks':len(audio),'chapters':len(chapters),'captionCues':len(cues),'voice':voice['voice'],'speechSamplesVerified':True,'fullDecode':'passed','compositor':'Linux Pillow + FFmpeg H.264/AAC; approved 1.2% zoom, 0.6-second chapter dissolve, fixed caption band','font':'DejaVu Sans 30px (Linux substitute for macOS Helvetica Neue)','sha256':hashlib.sha256(final.read_bytes()).hexdigest()}
(out/'validation.json').write_text(json.dumps(validation,indent=2))
print(json.dumps(validation),flush=True)
