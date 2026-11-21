export function createDiceSound() {
  let audio:AudioContext|undefined
  let noise:AudioBuffer|undefined

  function unlock() {
    if (!window.AudioContext) return
    try {
      audio ??= new AudioContext()
      if (audio.state==='suspended') void audio.resume().catch(()=>{})
    } catch { /* The visualization still works without audio support. */ }
  }

  function play(count:number) {
    if (!audio || audio.state!=='running') return
    const context=audio
    if (!noise) {
      noise=context.createBuffer(1,Math.ceil(context.sampleRate*.09),context.sampleRate)
      const samples=noise.getChannelData(0)
      for (let i=0;i<samples.length;i++) samples[i]=Math.random()*2-1
    }
    for (let i=0;i<Math.min(5,2+count);i++) {
      const time=context.currentTime+i*.066
      const source=context.createBufferSource()
      const filter=context.createBiquadFilter()
      const gain=context.createGain()
      source.buffer=noise
      source.playbackRate.value=1+i*.1
      filter.type='bandpass'
      filter.frequency.value=750+i*140
      gain.gain.setValueAtTime(.23/(1+i*.25),time)
      gain.gain.exponentialRampToValueAtTime(.001,time+.075)
      source.connect(filter).connect(gain).connect(context.destination)
      source.start(time)
    }
  }

  return {unlock,play,close:()=>{if(audio)void audio.close().catch(()=>{})}}
}
